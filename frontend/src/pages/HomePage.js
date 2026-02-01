import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CheckCircle, Clock, Target, TrendingUp, ArrowRight, Sparkles, History } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    candidate_name: '',
    candidate_email: ''
  });

  const handleStartInterview = async (e) => {
    e.preventDefault();
    
    if (!formData.candidate_name || !formData.candidate_email) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/interviews`, formData);
      toast.success('Interview session created!');
      navigate(`/setup/${response.data.id}`);
    } catch (error) {
      console.error('Error creating interview:', error);
      toast.error('Failed to create interview session');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Target,
      title: 'AI-Powered Questions',
      description: 'Adaptive questions based on your resume and job description'
    },
    {
      icon: Clock,
      title: 'Real-Time Evaluation',
      description: 'Instant feedback on your answers with time tracking'
    },
    {
      icon: TrendingUp,
      title: 'Dynamic Difficulty',
      description: 'Questions adjust based on your performance'
    },
    {
      icon: CheckCircle,
      title: 'Readiness Score',
      description: 'Get objective assessment of your interview preparedness'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 noise-bg">
      {/* Header */}
      <header className="border-b border-slate-200/60 backdrop-blur-md bg-white/70 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-800 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">InterviewAI</span>
          </div>
          <Button 
            onClick={() => navigate('/history')} 
            variant="outline" 
            className="border-slate-300"
          >
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Master Your Next
              <span className="block text-blue-800 mt-2">Technical Interview</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Practice with our AI interviewer that adapts to your skill level. Get objective feedback,
              improve your performance, and walk into your next interview with confidence.
            </p>

            {/* Form */}
            <Card className="p-6 glass-card border-slate-200">
              <form onSubmit={handleStartInterview} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Full Name
                  </label>
                  <Input
                    data-testid="candidate-name-input"
                    type="text"
                    placeholder="John Doe"
                    value={formData.candidate_name}
                    onChange={(e) => setFormData({ ...formData, candidate_name: e.target.value })}
                    className="h-12 border-slate-300 focus:border-blue-800 focus:ring-blue-800/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Email Address
                  </label>
                  <Input
                    data-testid="candidate-email-input"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.candidate_email}
                    onChange={(e) => setFormData({ ...formData, candidate_email: e.target.value })}
                    className="h-12 border-slate-300 focus:border-blue-800 focus:ring-blue-800/20"
                  />
                </div>
                <Button
                  data-testid="start-interview-button"
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-blue-800 hover:bg-blue-900 text-white font-semibold button-hover"
                >
                  {loading ? 'Creating...' : 'Start Mock Interview'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
            </Card>
          </motion.div>

          {/* Right Image */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1698047681452-08eba22d0c64?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBqb2IlMjBpbnRlcnZpZXclMjBjb25maWRlbnQlMjBjYW5kaWRhdGV8ZW58MHx8fHwxNzY5OTQ0ODc3fDA&ixlib=rb-4.1.0&q=85"
                alt="Professional candidate"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent"></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
            Why Practice With Us?
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Our AI interviewer simulates real interview conditions to help you prepare effectively
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 h-full border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-blue-800" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-sm text-slate-600">
          <p>© 2026 InterviewAI. Powered by AI for better interview preparation.</p>
        </div>
      </footer>
    </div>
  );
}