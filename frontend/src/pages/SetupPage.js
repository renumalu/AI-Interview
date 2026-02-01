import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Briefcase, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SetupPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [interview, setInterview] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [jdText, setJdText] = useState('');
  const [jdUploaded, setJdUploaded] = useState(false);

  useEffect(() => {
    fetchInterview();
  }, [interviewId]);

  const fetchInterview = async () => {
    try {
      const response = await axios.get(`${API}/interviews/${interviewId}`);
      setInterview(response.data);
      if (response.data.resume_text) setResumeUploaded(true);
      if (response.data.jd_text) {
        setJdUploaded(true);
        setJdText(response.data.jd_text);
      }
    } catch (error) {
      console.error('Error fetching interview:', error);
      toast.error('Failed to load interview');
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload PDF, DOCX, or TXT file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setResumeFile(file);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/interviews/${interviewId}/upload-resume`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Validate parsed data
      const parsedSkills = response.data.parsed_data?.skills || [];
      if (parsedSkills.length === 0) {
        toast.warning('No skills detected. Please ensure your resume includes your technical skills.');
      }

      toast.success('Resume uploaded and analyzed!');
      setResumeUploaded(true);
      fetchInterview();
    } catch (error) {
      console.error('Error uploading resume:', error);
      toast.error('Failed to upload resume. Please check the file format.');
    } finally {
      setLoading(false);
    }
  };

  const handleJdSubmit = async () => {
    if (!jdText.trim()) {
      toast.error('Please enter job description');
      return;
    }

    // Validate JD has minimum content
    if (jdText.trim().length < 50) {
      toast.error('Job description is too short. Please provide more details.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('jd_text', jdText);

      await axios.post(
        `${API}/interviews/${interviewId}/upload-jd`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      toast.success('Job description saved!');
      setJdUploaded(true);
      fetchInterview();
    } catch (error) {
      console.error('Error uploading JD:', error);
      toast.error('Failed to save job description');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = () => {
    if (!resumeUploaded || !jdUploaded) {
      toast.error('Please complete both steps');
      return;
    }
    navigate(`/interview/${interviewId}`);
  };

  const progress = (resumeUploaded ? 50 : 0) + (jdUploaded ? 50 : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-slate-200/60 backdrop-blur-md bg-white/70">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Interview Setup</h1>
            <div className="text-sm text-slate-600">
              {interview?.candidate_name}
            </div>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Step 1: Resume Upload */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-8 border-slate-200">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  resumeUploaded ? 'bg-emerald-100' : 'bg-blue-100'
                }`}>
                  {resumeUploaded ? (
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <FileText className="w-6 h-6 text-blue-800" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Step 1: Upload Your Resume
                  </h2>
                  <p className="text-slate-600 mb-6">
                    Upload your resume so our AI can understand your background and tailor questions accordingly.
                    Supported formats: PDF, DOCX, TXT
                  </p>

                  {!resumeUploaded ? (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-800 transition-colors">
                      <input
                        data-testid="resume-upload-input"
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleResumeUpload}
                        className="hidden"
                        id="resume-upload"
                        disabled={loading}
                      />
                      <label htmlFor="resume-upload" className="cursor-pointer">
                        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-700 font-medium mb-1">
                          {loading ? 'Analyzing resume...' : 'Click to upload resume'}
                        </p>
                        <p className="text-sm text-slate-500">
                          PDF, DOCX, or TXT (Max 10MB)
                        </p>
                      </label>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Resume uploaded and analyzed</span>
                      </div>
                      {interview?.parsed_skills && interview.parsed_skills.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-emerald-600 mb-2">Detected Skills:</p>
                          <div className="flex flex-wrap gap-2">
                            {interview.parsed_skills.slice(0, 8).map((skill, idx) => (
                              <span key={idx} className="px-3 py-1 bg-white border border-emerald-200 rounded-full text-xs text-emerald-700">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Step 2: Job Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="p-8 border-slate-200">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  jdUploaded ? 'bg-emerald-100' : 'bg-blue-100'
                }`}>
                  {jdUploaded ? (
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Briefcase className="w-6 h-6 text-blue-800" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Step 2: Enter Job Description
                  </h2>
                  <p className="text-slate-600 mb-6">
                    Paste the job description you're applying for. The AI will align interview questions with the role requirements.
                  </p>

                  <Textarea
                    data-testid="jd-textarea"
                    placeholder="Paste the complete job description here..."
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    className="min-h-[200px] border-slate-300 focus:border-blue-800 focus:ring-blue-800/20 mb-4"
                    disabled={jdUploaded}
                  />

                  {!jdUploaded ? (
                    <Button
                      data-testid="save-jd-button"
                      onClick={handleJdSubmit}
                      disabled={loading || !jdText.trim()}
                      className="bg-blue-800 hover:bg-blue-900 text-white button-hover"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Job Description'
                      )}
                    </Button>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Job description saved</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Start Interview Button */}
          {resumeUploaded && jdUploaded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <Card className="p-8 bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-200">
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  Ready to Begin!
                </h3>
                <p className="text-slate-600 mb-6 max-w-xl mx-auto">
                  Your interview setup is complete. You'll face 6-8 adaptive questions.
                  Answer thoughtfully and manage your time well. Good luck!
                </p>
                <Button
                  data-testid="begin-interview-button"
                  onClick={handleStartInterview}
                  size="lg"
                  className="bg-blue-800 hover:bg-blue-900 text-white text-lg px-8 py-6 button-hover"
                >
                  Begin Interview
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}