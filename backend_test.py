import requests
import sys
import json
import time
from datetime import datetime
from pathlib import Path

class InterviewAPITester:
    def __init__(self, base_url="https://hiresimulator.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.interview_id = None
        self.question_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, timeout=30)
                elif data and isinstance(data, dict) and 'jd_text' in data:
                    # Form data for JD upload
                    response = requests.post(url, data=data, timeout=30)
                else:
                    headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_create_interview(self):
        """Test interview creation"""
        test_data = {
            "candidate_name": f"Test User {datetime.now().strftime('%H%M%S')}",
            "candidate_email": f"test{datetime.now().strftime('%H%M%S')}@example.com"
        }
        
        success, response = self.run_test(
            "Create Interview",
            "POST",
            "interviews",
            200,
            data=test_data
        )
        
        if success and 'id' in response:
            self.interview_id = response['id']
            print(f"   Interview ID: {self.interview_id}")
            return True
        return False

    def test_get_interview(self):
        """Test getting interview details"""
        if not self.interview_id:
            print("❌ No interview ID available")
            return False
            
        success, response = self.run_test(
            "Get Interview",
            "GET",
            f"interviews/{self.interview_id}",
            200
        )
        return success

    def test_upload_resume(self):
        """Test resume upload with a sample text file"""
        if not self.interview_id:
            print("❌ No interview ID available")
            return False
            
        # Create a sample resume content
        resume_content = """
John Doe
Software Engineer

EXPERIENCE:
- 5 years of Python development
- 3 years of React and JavaScript
- Experience with FastAPI, MongoDB, Docker
- Built scalable web applications

SKILLS:
- Python, JavaScript, React, FastAPI
- MongoDB, PostgreSQL, Redis
- Docker, Kubernetes, AWS
- Git, CI/CD, Testing

EDUCATION:
- Bachelor's in Computer Science
- Various online certifications
        """.strip()
        
        # Create temporary file
        files = {
            'file': ('resume.txt', resume_content, 'text/plain')
        }
        
        success, response = self.run_test(
            "Upload Resume",
            "POST",
            f"interviews/{self.interview_id}/upload-resume",
            200,
            files=files
        )
        return success

    def test_upload_jd(self):
        """Test job description upload"""
        if not self.interview_id:
            print("❌ No interview ID available")
            return False
            
        jd_text = """
Senior Software Engineer - Full Stack

We are looking for an experienced Full Stack Developer to join our team.

REQUIREMENTS:
- 3+ years of experience in Python and JavaScript
- Experience with React, FastAPI, or similar frameworks
- Knowledge of databases (MongoDB, PostgreSQL)
- Experience with cloud platforms (AWS, GCP)
- Strong problem-solving skills
- Experience with microservices architecture

RESPONSIBILITIES:
- Design and develop scalable web applications
- Work with cross-functional teams
- Implement best practices for code quality
- Participate in code reviews and technical discussions
        """
        
        success, response = self.run_test(
            "Upload Job Description",
            "POST",
            f"interviews/{self.interview_id}/upload-jd",
            200,
            data={"jd_text": jd_text}
        )
        return success

    def test_start_interview(self):
        """Test starting the interview"""
        if not self.interview_id:
            print("❌ No interview ID available")
            return False
            
        success, response = self.run_test(
            "Start Interview",
            "POST",
            f"interviews/{self.interview_id}/start",
            200
        )
        
        if success and 'id' in response:
            self.question_id = response['id']
            print(f"   First Question ID: {self.question_id}")
            return True
        return False

    def test_submit_answer(self):
        """Test submitting an answer"""
        if not self.interview_id or not self.question_id:
            print("❌ No interview ID or question ID available")
            return False
            
        answer_data = {
            "answer_text": "I have 5 years of experience with Python development, focusing on web applications using FastAPI and Flask. I've worked with MongoDB for data storage and have experience building RESTful APIs. In my previous role, I developed microservices architecture and implemented CI/CD pipelines.",
            "time_taken": 120
        }
        
        success, response = self.run_test(
            "Submit Answer",
            "POST",
            f"interviews/{self.interview_id}/questions/{self.question_id}/answer",
            200,
            data=answer_data
        )
        
        if success and response.get('question'):
            self.question_id = response['question']['id']
            print(f"   Next Question ID: {self.question_id}")
        
        return success

    def test_get_questions(self):
        """Test getting all questions for interview"""
        if not self.interview_id:
            print("❌ No interview ID available")
            return False
            
        success, response = self.run_test(
            "Get Interview Questions",
            "GET",
            f"interviews/{self.interview_id}/questions",
            200
        )
        return success

def main():
    print("🚀 Starting AI Interview Platform API Tests")
    print("=" * 50)
    
    tester = InterviewAPITester()
    
    # Test sequence
    tests = [
        ("Create Interview", tester.test_create_interview),
        ("Get Interview", tester.test_get_interview),
        ("Upload Resume", tester.test_upload_resume),
        ("Upload Job Description", tester.test_upload_jd),
        ("Start Interview", tester.test_start_interview),
        ("Submit Answer", tester.test_submit_answer),
        ("Get Questions", tester.test_get_questions),
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                print(f"\n⚠️  {test_name} failed - stopping dependent tests")
                break
            # Add delay for AI processing
            if test_name in ["Upload Resume", "Start Interview", "Submit Answer"]:
                print("   ⏳ Waiting for AI processing...")
                time.sleep(3)
        except Exception as e:
            print(f"\n💥 {test_name} crashed: {str(e)}")
            break
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())