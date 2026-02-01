import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, ArrowRight, Home, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState([]);
  const [filter, setFilter] = useState('all'); // all, completed, terminated

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/interviews/history`);
      setInterviews(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load interview history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status, score) => {
    if (status === 'completed') {
      if (score >= 75) return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      if (score >= 60) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      return <XCircle className="w-5 h-5 text-rose-600" />;
    }
    if (status === 'terminated') return <XCircle className="w-5 h-5 text-rose-600" />;
    return <Clock className="w-5 h-5 text-slate-400" />;
  };

  const getStatusColor = (status) => {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'terminated') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredInterviews = interviews.filter(interview => {
    if (filter === 'all') return true;
    return interview.status === filter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-800 mx-auto mb-4" />
          <p className="text-slate-600">Loading interview history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b border-slate-200/60 backdrop-blur-md bg-white/70">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="w-8 h-8 text-blue-800" />
              <h1 className="text-2xl font-bold text-slate-900">Interview History</h1>
            </div>
            <Button onClick={() => navigate('/')} variant="outline" className="border-slate-300">
              <Home className="mr-2 h-4 w-4" />Home
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex gap-3 mb-6">
          <Button 
            onClick={() => setFilter('all')} 
            variant={filter === 'all' ? 'default' : 'outline'}
            className={filter === 'all' ? 'bg-blue-800' : ''}
          >
            All ({interviews.length})
          </Button>
          <Button 
            onClick={() => setFilter('completed')} 
            variant={filter === 'completed' ? 'default' : 'outline'}
            className={filter === 'completed' ? 'bg-blue-800' : ''}
          >
            Completed ({interviews.filter(i => i.status === 'completed').length})
          </Button>
          <Button 
            onClick={() => setFilter('terminated')} 
            variant={filter === 'terminated' ? 'default' : 'outline'}
            className={filter === 'terminated' ? 'bg-blue-800' : ''}
          >
            Terminated ({interviews.filter(i => i.status === 'terminated').length})
          </Button>
        </div>

        {filteredInterviews.length === 0 ? (
          <Card className="p-12 text-center">
            <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Interviews Found</h3>
            <p className="text-slate-600 mb-6">Start your first mock interview to see your history here.</p>
            <Button onClick={() => navigate('/')} className="bg-blue-800 hover:bg-blue-900">
              Start Interview
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredInterviews.map((interview, idx) => (
              <motion.div
                key={interview.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                <Card className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">
                        {getStatusIcon(interview.status, interview.overall_score)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-slate-900">{interview.candidate_name}</h3>
                          <Badge className={`${getStatusColor(interview.status)} border`}>
                            {interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
                          </Badge>
                          {interview.overall_score && (
                            <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800">
                              Score: {interview.overall_score.toFixed(1)}/100
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-1">{interview.candidate_email}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(interview.created_at)}
                          </span>
                          {interview.parsed_skills && interview.parsed_skills.length > 0 && (
                            <span>{interview.parsed_skills.length} skills detected</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => navigate(`/results/${interview.id}`)}
                      className="bg-blue-800 hover:bg-blue-900"
                      disabled={interview.status !== 'completed' && interview.status !== 'terminated'}
                    >
                      View Results
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}