from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import PyPDF2
import docx
import io
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class InterviewCreate(BaseModel):
    candidate_name: str
    candidate_email: str

class Interview(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_name: str
    candidate_email: str
    resume_text: Optional[str] = None
    jd_text: Optional[str] = None
    parsed_skills: Optional[List[str]] = None
    parsed_experience: Optional[str] = None
    status: str = "setup"  # setup, in_progress, completed, terminated
    overall_score: Optional[float] = None
    readiness_level: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class QuestionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    interview_id: str
    question_number: int
    question_text: str
    difficulty: str  # easy, medium, hard
    time_allocated: int  # seconds
    answer_text: Optional[str] = None
    time_taken: Optional[int] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnswerSubmission(BaseModel):
    answer_text: str
    time_taken: int

class InterviewReport(BaseModel):
    interview_id: str
    overall_score: float
    readiness_level: str
    total_questions: int
    questions_answered: int
    skill_scores: Dict[str, float]
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[str]

# Helper functions
def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        return text
    except Exception as e:
        logging.error(f"Error extracting PDF: {str(e)}")
        return ""

def extract_text_from_docx(file_content: bytes) -> str:
    """Extract text from DOCX file"""
    try:
        doc = docx.Document(io.BytesIO(file_content))
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text
    except Exception as e:
        logging.error(f"Error extracting DOCX: {str(e)}")
        return ""

async def parse_resume_with_ai(resume_text: str) -> Dict[str, Any]:
    """Parse resume using AI to extract skills and experience"""
    try:
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"resume_parse_{uuid.uuid4()}",
            system_message="You are an expert resume parser. Extract key information from resumes."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Analyze this resume and extract:
1. Technical skills (list)
2. Years of experience
3. Key projects or achievements (brief)
4. Educational background

Resume:
{resume_text}

Respond in JSON format with keys: skills (array), experience_years (string), projects (string), education (string)"""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        # Parse JSON response
        try:
            parsed_data = json.loads(response)
        except:
            # If not valid JSON, create structured response
            parsed_data = {
                "skills": [],
                "experience_years": "Not specified",
                "projects": "Not specified",
                "education": "Not specified"
            }
        
        return parsed_data
    except Exception as e:
        logging.error(f"Error parsing resume: {str(e)}")
        return {
            "skills": [],
            "experience_years": "Unknown",
            "projects": "Unknown",
            "education": "Unknown"
        }

async def generate_question(interview_id: str, question_number: int, difficulty: str, 
                           resume_data: Dict, jd_text: str, previous_performance: Optional[float] = None) -> Dict[str, Any]:
    """Generate interview question based on context and difficulty"""
    try:
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"interview_{interview_id}",
            system_message="You are an expert technical interviewer. Ask relevant, challenging questions."
        ).with_model("openai", "gpt-5.2")
        
        skills_str = ", ".join(resume_data.get('skills', []))
        
        prompt = f"""Generate a {difficulty} difficulty interview question.

Candidate Profile:
- Skills: {skills_str}
- Experience: {resume_data.get('experience_years', 'Unknown')}

Job Requirements:
{jd_text[:500]}

Question Number: {question_number}
Previous Performance: {previous_performance if previous_performance else 'First question'}

Generate a question that:
1. Tests technical knowledge relevant to the JD
2. Is appropriate for {difficulty} difficulty
3. Can be answered in 2-5 minutes

Respond with JSON: {{"question": "your question here", "time_allocated": seconds}}"""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        try:
            question_data = json.loads(response)
        except:
            question_data = {
                "question": response[:500],
                "time_allocated": 180
            }
        
        return question_data
    except Exception as e:
        logging.error(f"Error generating question: {str(e)}")
        return {
            "question": "Please describe your experience with the technologies mentioned in the job description.",
            "time_allocated": 180
        }

async def evaluate_answer(question_text: str, answer_text: str, time_allocated: int, 
                         time_taken: int, difficulty: str) -> Dict[str, Any]:
    """Evaluate answer and provide score and feedback"""
    try:
        # Check for empty or invalid answers
        if not answer_text or len(answer_text.strip()) < 10:
            return {
                "score": 0.0,
                "feedback": "No meaningful answer provided. Please provide a detailed response.",
                "strengths": "N/A",
                "weaknesses": "Answer not provided"
            }
        
        # Check for irrelevant answers
        irrelevant_keywords = ['nil', "don't know", "dont know", "idk", "no idea", "not sure", "pass", "skip"]
        if any(keyword in answer_text.lower() for keyword in irrelevant_keywords) and len(answer_text.strip()) < 50:
            return {
                "score": 5.0,
                "feedback": "Answer appears incomplete or indicates lack of knowledge. Try your best to provide relevant information.",
                "strengths": "Acknowledged uncertainty",
                "weaknesses": "Insufficient attempt at answering"
            }
        
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"eval_{uuid.uuid4()}",
            system_message="You are an expert interviewer. Evaluate answers objectively."
        ).with_model("openai", "gpt-5.2")
        
        time_efficiency = min(100, (time_allocated / max(time_taken, 1)) * 100)
        
        prompt = f"""Evaluate this interview answer:

Question ({difficulty} difficulty): {question_text}
Answer: {answer_text}
Time Allocated: {time_allocated}s
Time Taken: {time_taken}s

Evaluate on:
1. Accuracy (0-100)
2. Clarity (0-100)
3. Depth (0-100)
4. Relevance (0-100)

Provide:
- Overall score (0-100)
- Brief feedback (2-3 sentences)
- Key strengths
- Areas for improvement

Respond in JSON: {{"score": number, "feedback": "text", "strengths": "text", "weaknesses": "text"}}"""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        try:
            eval_data = json.loads(response)
            # Factor in time efficiency
            final_score = (eval_data['score'] * 0.85) + (time_efficiency * 0.15)
            eval_data['score'] = round(final_score, 2)
        except:
            eval_data = {
                "score": 50.0,
                "feedback": "Unable to evaluate fully. Please provide more detailed answers.",
                "strengths": "Answer provided",
                "weaknesses": "More detail needed"
            }
        
        return eval_data
    except Exception as e:
        logging.error(f"Error evaluating answer: {str(e)}")
        return {
            "score": 50.0,
            "feedback": "Evaluation error occurred.",
            "strengths": "N/A",
            "weaknesses": "N/A"
        }

async def generate_final_report(interview_id: str) -> InterviewReport:
    """Generate comprehensive interview report"""
    try:
        # Get interview
        interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Get all questions
        questions = await db.questions.find({"interview_id": interview_id}, {"_id": 0}).to_list(100)
        
        if not questions:
            raise HTTPException(status_code=400, detail="No questions answered")
        
        # Calculate metrics
        total_questions = len(questions)
        answered_questions = [q for q in questions if q.get('answer_text')]
        questions_answered = len(answered_questions)
        
        if questions_answered == 0:
            overall_score = 0.0
        else:
            overall_score = sum(q.get('score', 0) for q in answered_questions) / questions_answered
        
        # Determine readiness level
        if overall_score >= 75:
            readiness_level = "Ready for Interviews"
        elif overall_score >= 60:
            readiness_level = "Needs Some Improvement"
        else:
            readiness_level = "Needs Significant Preparation"
        
        # Skill scores (simplified)
        skill_scores = {
            "Technical Knowledge": round(overall_score * 0.95, 2),
            "Communication": round(overall_score * 1.05, 2),
            "Problem Solving": round(overall_score * 0.98, 2),
            "Time Management": round(overall_score * 0.92, 2)
        }
        
        # Generate AI-powered insights
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"report_{interview_id}",
            system_message="You are an interview coach providing actionable feedback."
        ).with_model("openai", "gpt-5.2")
        
        qa_summary = "\n".join([f"Q{i+1}: {q['question_text'][:100]}... Score: {q.get('score', 0)}" 
                                for i, q in enumerate(answered_questions)])
        
        prompt = f"""Based on this interview performance (score: {overall_score:.1f}/100):

{qa_summary}

Provide:
1. Top 3 strengths
2. Top 3 weaknesses
3. Top 3 actionable recommendations

Respond in JSON: {{"strengths": ["s1", "s2", "s3"], "weaknesses": ["w1", "w2", "w3"], "recommendations": ["r1", "r2", "r3"]}}"""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        try:
            insights = json.loads(response)
        except:
            insights = {
                "strengths": ["Completed interview", "Provided answers", "Engaged with questions"],
                "weaknesses": ["Need more technical depth", "Time management", "Answer clarity"],
                "recommendations": ["Practice more", "Study core concepts", "Work on communication"]
            }
        
        # Update interview
        await db.interviews.update_one(
            {"id": interview_id},
            {"$set": {
                "status": "completed",
                "overall_score": overall_score,
                "readiness_level": readiness_level,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        report = InterviewReport(
            interview_id=interview_id,
            overall_score=round(overall_score, 2),
            readiness_level=readiness_level,
            total_questions=total_questions,
            questions_answered=questions_answered,
            skill_scores=skill_scores,
            strengths=insights['strengths'],
            weaknesses=insights['weaknesses'],
            recommendations=insights['recommendations']
        )
        
        return report
        
    except Exception as e:
        logging.error(f"Error generating report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# API Routes
@api_router.post("/interviews", response_model=Interview)
async def create_interview(data: InterviewCreate):
    """Create a new interview session"""
    interview = Interview(
        candidate_name=data.candidate_name,
        candidate_email=data.candidate_email
    )
    
    doc = interview.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.interviews.insert_one(doc)
    return interview

@api_router.post("/interviews/{interview_id}/upload-resume")
async def upload_resume(
    interview_id: str,
    file: UploadFile = File(...)
):
    """Upload and parse resume"""
    try:
        # Check interview exists
        interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Read file
        content = await file.read()
        
        # Extract text based on file type
        filename = file.filename.lower()
        if filename.endswith('.pdf'):
            resume_text = extract_text_from_pdf(content)
        elif filename.endswith('.docx'):
            resume_text = extract_text_from_docx(content)
        elif filename.endswith('.txt'):
            resume_text = content.decode('utf-8')
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from resume")
        
        # Parse resume with AI
        parsed_data = await parse_resume_with_ai(resume_text)
        
        # Update interview
        await db.interviews.update_one(
            {"id": interview_id},
            {"$set": {
                "resume_text": resume_text,
                "parsed_skills": parsed_data.get('skills', []),
                "parsed_experience": parsed_data.get('experience_years', 'Unknown')
            }}
        )
        
        return {
            "success": True,
            "parsed_data": parsed_data,
            "message": "Resume uploaded and parsed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading resume: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/interviews/{interview_id}/upload-jd")
async def upload_jd(
    interview_id: str,
    jd_text: str = Form(...)
):
    """Upload job description"""
    try:
        # Check interview exists
        interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Update interview
        await db.interviews.update_one(
            {"id": interview_id},
            {"$set": {"jd_text": jd_text}}
        )
        
        return {"success": True, "message": "Job description uploaded successfully"}
        
    except Exception as e:
        logging.error(f"Error uploading JD: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/interviews/{interview_id}/start")
async def start_interview(interview_id: str):
    """Start interview and get first question"""
    try:
        # Get interview
        interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        if not interview.get('resume_text') or not interview.get('jd_text'):
            raise HTTPException(status_code=400, detail="Resume and JD required")
        
        # Update status
        await db.interviews.update_one(
            {"id": interview_id},
            {"$set": {"status": "in_progress"}}
        )
        
        # Generate first question (easy difficulty)
        resume_data = {
            "skills": interview.get('parsed_skills', []),
            "experience_years": interview.get('parsed_experience', 'Unknown')
        }
        
        question_data = await generate_question(
            interview_id, 1, "easy", resume_data, interview['jd_text']
        )
        
        # Save question
        question = QuestionResponse(
            interview_id=interview_id,
            question_number=1,
            question_text=question_data['question'],
            difficulty="easy",
            time_allocated=question_data.get('time_allocated', 180)
        )
        
        doc = question.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.questions.insert_one(doc)
        
        return question
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting interview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/interviews/{interview_id}/questions/{question_id}/answer")
async def submit_answer(
    interview_id: str,
    question_id: str,
    data: AnswerSubmission
):
    """Submit answer and get next question"""
    try:
        # Get question
        question = await db.questions.find_one(
            {"id": question_id, "interview_id": interview_id},
            {"_id": 0}
        )
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Evaluate answer
        eval_data = await evaluate_answer(
            question['question_text'],
            data.answer_text,
            question['time_allocated'],
            data.time_taken,
            question['difficulty']
        )
        
        # Update question with answer and score
        await db.questions.update_one(
            {"id": question_id},
            {"$set": {
                "answer_text": data.answer_text,
                "time_taken": data.time_taken,
                "score": eval_data['score'],
                "feedback": eval_data['feedback']
            }}
        )
        
        # Check if should terminate early (score < 30 on 2+ questions)
        questions_so_far = await db.questions.find(
            {"interview_id": interview_id, "answer_text": {"$ne": None}},
            {"_id": 0}
        ).to_list(100)
        
        avg_score = sum(q.get('score', 0) for q in questions_so_far) / len(questions_so_far)
        
        if len(questions_so_far) >= 2 and avg_score < 30:
            # Terminate interview
            await db.interviews.update_one(
                {"id": interview_id},
                {"$set": {"status": "terminated"}}
            )
            return {
                "question": None,
                "terminated": True,
                "reason": "Performance below threshold",
                "score": eval_data['score'],
                "feedback": eval_data['feedback']
            }
        
        # Determine next difficulty
        if eval_data['score'] >= 75:
            next_difficulty = "hard" if question['difficulty'] == "medium" else "medium"
        elif eval_data['score'] >= 50:
            next_difficulty = "medium"
        else:
            next_difficulty = "easy"
        
        # Check if reached max questions (8)
        if len(questions_so_far) >= 8:
            await db.interviews.update_one(
                {"id": interview_id},
                {"$set": {"status": "completed"}}
            )
            return {
                "question": None,
                "completed": True,
                "score": eval_data['score'],
                "feedback": eval_data['feedback']
            }
        
        # Generate next question
        interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
        resume_data = {
            "skills": interview.get('parsed_skills', []),
            "experience_years": interview.get('parsed_experience', 'Unknown')
        }
        
        next_question_data = await generate_question(
            interview_id,
            question['question_number'] + 1,
            next_difficulty,
            resume_data,
            interview['jd_text'],
            eval_data['score']
        )
        
        # Save next question
        next_question = QuestionResponse(
            interview_id=interview_id,
            question_number=question['question_number'] + 1,
            question_text=next_question_data['question'],
            difficulty=next_difficulty,
            time_allocated=next_question_data.get('time_allocated', 180)
        )
        
        doc = next_question.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.questions.insert_one(doc)
        
        return {
            "question": next_question,
            "previous_score": eval_data['score'],
            "previous_feedback": eval_data['feedback'],
            "terminated": False,
            "completed": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error submitting answer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/interviews/{interview_id}")
async def get_interview(interview_id: str):
    """Get interview details"""
    interview = await db.interviews.find_one({"id": interview_id}, {"_id": 0})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview

@api_router.get("/interviews/{interview_id}/report")
async def get_interview_report(interview_id: str):
    """Get comprehensive interview report"""
    try:
        report = await generate_final_report(interview_id)
        return report
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/interviews/{interview_id}/questions")
async def get_interview_questions(interview_id: str):
    """Get all questions for an interview"""
    questions = await db.questions.find({"interview_id": interview_id}, {"_id": 0}).to_list(100)
    return questions

@api_router.get("/interviews/history")
async def get_interview_history():
    """Get all interviews for history view"""
    try:
        interviews = await db.interviews.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Convert datetime to ISO string for JSON serialization
        for interview in interviews:
            if isinstance(interview.get('created_at'), datetime):
                interview['created_at'] = interview['created_at'].isoformat()
            if interview.get('completed_at') and isinstance(interview['completed_at'], datetime):
                interview['completed_at'] = interview['completed_at'].isoformat()
        
        return interviews
    except Exception as e:
        logging.error(f"Error fetching history: {str(e)}")
        return []

# New endpoints for enhanced features

class DraftSave(BaseModel):
    question_id: str
    draft_answer: str

@api_router.post("/interviews/{interview_id}/save-draft")
async def save_draft(interview_id: str, data: DraftSave):
    """Save draft answer"""
    try:
        await db.drafts.update_one(
            {"interview_id": interview_id, "question_id": data.question_id},
            {"$set": {
                "draft_answer": data.draft_answer,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {"success": True, "message": "Draft saved"}
    except Exception as e:
        logging.error(f"Error saving draft: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class AssistantRequest(BaseModel):
    interview_id: str
    question: str
    user_message: str

@api_router.post("/assistant/help")
async def get_assistant_help(data: AssistantRequest):
    """Get AI assistant help"""
    try:
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"assistant_{data.interview_id}",
            system_message="You are a helpful interview coach. Provide guidance without giving direct answers."
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""Interview Question: {data.question}

User needs help: {data.user_message}

Provide helpful guidance that:
1. Clarifies the question if needed
2. Suggests approaches to think about
3. Does NOT give the direct answer
4. Encourages the candidate to think critically

Keep response concise (2-3 sentences)."""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        return {"response": response}
    except Exception as e:
        logging.error(f"Error with assistant: {str(e)}")
        return {"response": "I'm here to help! Please try rephrasing your question."}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()