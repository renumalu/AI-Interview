import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Send, AlertCircle, Loader2, Mic, MicOff, Save } from 'lucide-react';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { AIAssistant } from '@/components/AIAssistant';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InterviewPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [timeStarted, setTimeStarted] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    startInterview();
    
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setAnswer(prev => prev + ' ' + transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  useEffect(() => {
    if (currentQuestion && timeLeft === null) {
      setTimeLeft(currentQuestion.time_allocated);
      setTimeStarted(Date.now());
      
      // Load draft answer if exists
      const draft = localStorage.getItem(`draft_${currentQuestion.id}`);
      if (draft) {
        setAnswer(draft);
        toast.info('Draft answer loaded');
      }
    }
  }, [currentQuestion]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timerRef.current);
    }
  }, [timeLeft]);

  const startInterview = async () => {
    try {
      const response = await axios.post(`${API}/interviews/${interviewId}/start`);
      setCurrentQuestion(response.data);
      setQuestionNumber(response.data.question_number);
      setLoading(false);
    } catch (error) {
      console.error('Error starting interview:', error);
      toast.error('Failed to start interview');
      setLoading(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!answer.trim()) {
      toast.error('Time up! Moving to next question.');
    }
    await submitAnswer();
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input not supported in your browser');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      toast.info('Voice recording stopped');
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      toast.success('Voice recording started');
    }
  };

  const saveDraft = async () => {
    if (!answer.trim() || !currentQuestion) return;
    
    setSaving(true);
    try {
      localStorage.setItem(`draft_${currentQuestion.id}`, answer);
      await axios.post(`${API}/interviews/${interviewId}/save-draft`, {
        question_id: currentQuestion.id,
        draft_answer: answer
      });
      toast.success('Draft saved!');
    } catch (error) {
      console.error('Error saving draft:', error);
      // Still save locally even if server fails
      toast.info('Draft saved locally');
    } finally {
      setSaving(false);
    }
  };

  const submitAnswer = async () => {
    if (submitting) return;

    const timeTaken = timeStarted ? Math.floor((Date.now() - timeStarted) / 1000) : currentQuestion.time_allocated;
    const answerText = answer.trim();
    
    // Validate answer
    if (!answerText || answerText.toLowerCase() === 'nil' || answerText.toLowerCase() === "don't know" || answerText.toLowerCase() === "dont know") {
      toast.warning('Please provide a meaningful answer');
    }
    
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    try {
      const response = await axios.post(
        `${API}/interviews/${interviewId}/questions/${currentQuestion.id}/answer`,
        {
          answer_text: answerText || 'No answer provided',
          time_taken: timeTaken
        }
      );

      // Clear draft
      localStorage.removeItem(`draft_${currentQuestion.id}`);

      // Show feedback dialog
      setFeedbackData({
        score: response.data.previous_score || 0,
        feedback: response.data.previous_feedback || ''
      });
      setShowFeedback(true);

      // Store next question data
      if (response.data.terminated) {
        setTimeout(() => {
          setShowFeedback(false);
          navigate(`/results/${interviewId}`);
        }, 3000);
        return;
      }

      if (response.data.completed) {
        setTimeout(() => {
          setShowFeedback(false);
          navigate(`/results/${interviewId}`);
        }, 3000);
        return;
      }

      // Next question
      if (response.data.question) {
        setCurrentQuestion(response.data.question);
        setQuestionNumber(response.data.question.question_number);
        setAnswer('');
        setTimeLeft(response.data.question.time_allocated);
        setTimeStarted(Date.now());
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackContinue = () => {
    setShowFeedback(false);
  };

  const formatTime = (seconds) => {
    if (seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (!currentQuestion || timeLeft === null) return 'text-slate-600';
    const percentage = (timeLeft / currentQuestion.time_allocated) * 100;
    if (percentage <= 20) return 'text-rose-600 timer-warning';
    if (percentage <= 40) return 'text-amber-500';
    return 'text-emerald-600';
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'hard': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-800 mx-auto mb-4" />
          <p className="text-slate-600">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-slate-900">Interview in Progress</h1>
              {currentQuestion && (
                <Badge variant="outline" className="border-slate-300">
                  Question {questionNumber} of 8
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className={`w-5 h-5 ${getTimerColor()}`} />
                <span className={`text-2xl font-mono font-bold ${getTimerColor()}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="interview-split">
        <div className="bg-white p-8 flex flex-col">
          <AnimatePresence mode="wait">
            {currentQuestion && (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
                className="flex-1 flex flex-col"
              >
                <div className="mb-6">
                  <Badge 
                    data-testid="difficulty-badge"
                    className={`${getDifficultyColor(currentQuestion.difficulty)} border px-3 py-1 text-sm font-semibold uppercase`}
                  >
                    {currentQuestion.difficulty}
                  </Badge>
                </div>

                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-slate-900 mb-6 leading-tight">
                    {currentQuestion.question_text}
                  </h2>
                  
                  <Card className="p-6 bg-blue-50 border-blue-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-800 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold mb-1">Tips for answering:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800">
                          <li>Be specific and provide examples</li>
                          <li>Structure your answer clearly</li>
                          <li>Use voice input or type your answer</li>
                          <li>Save drafts to avoid losing progress</li>
                        </ul>
                      </div>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-slate-100 p-8 flex flex-col border-l border-slate-200">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <label className="text-lg font-semibold text-slate-900">
                Your Answer
              </label>
              <div className="flex gap-2">
                <Button
                  onClick={toggleRecording}
                  variant="outline"
                  size="sm"
                  className={isRecording ? 'bg-rose-100 border-rose-300' : ''}
                >
                  {isRecording ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                  {isRecording ? 'Stop' : 'Voice'}
                </Button>
                <Button
                  onClick={saveDraft}
                  variant="outline"
                  size="sm"
                  disabled={saving || !answer.trim()}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Draft
                </Button>
              </div>
            </div>
            
            <Textarea
              data-testid="answer-textarea"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here or use voice input..."
              className="flex-1 min-h-[300px] text-base border-slate-300 focus:border-blue-800 focus:ring-blue-800/20 resize-none bg-white"
              disabled={submitting || timeLeft === 0 || timeLeft === null}
            />

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                {answer.length} characters {answer.trim() ? '' : '(Please provide an answer)'}
              </div>
              
              <Button
                data-testid="submit-answer-button"
                onClick={submitAnswer}
                disabled={submitting || timeLeft === 0}
                size="lg"
                className="bg-blue-800 hover:bg-blue-900 text-white px-8 button-hover"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Answer
                    <Send className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {feedbackData && (
        <FeedbackDialog
          open={showFeedback}
          onOpenChange={setShowFeedback}
          score={feedbackData.score}
          feedback={feedbackData.feedback}
          onContinue={handleFeedbackContinue}
        />
      )}

      <AIAssistant interviewId={interviewId} currentQuestion={currentQuestion} />
    </div>
  );
}