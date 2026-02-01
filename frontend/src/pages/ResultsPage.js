import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Loader2, TrendingUp, TrendingDown, Lightbulb, ArrowRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function SkillBar({ skill, score }) {
  const width = Math.min(100, score);
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{skill}</span>
        <span className="text-sm font-bold text-blue-800">{score.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3">
        <div className="bg-blue-800 h-3 rounded-full" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [interview, setInterview] = useState(null);

  useEffect(() => {
    axios.get(`${API}/interviews/${interviewId}/report`)
      .then(res => setReport(res.data))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
    
    axios.get(`${API}/interviews/${interviewId}`)
      .then(res => setInterview(res.data))
      .catch(() => {});
  }, [interviewId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-800" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="p-8"><h2>Report not available</h2></Card>
      </div>
    );
  }

  const score = report.overall_score;
  const scoreColor = score >= 75 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-rose-600';
  const bgColor = score >= 75 ? 'bg-emerald-50 border-emerald-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Interview Results</h1>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="mr-2 h-4 w-4" />Home
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card className="p-6">
          <div className="flex justify-between">
            <div>
              <h2 className="text-xl font-bold">{interview?.candidate_name}</h2>
              <p className="text-slate-600">{interview?.candidate_email}</p>
            </div>
            <Badge>{report.questions_answered} / {report.total_questions}</Badge>
          </div>
        </Card>

        <Card className={`p-8 border-2 ${bgColor}`}>
          <div className="text-center">
            <div className={`text-7xl font-bold ${scoreColor} mb-2`}>{score.toFixed(1)}</div>
            <h2 className="text-2xl font-bold mb-2">{report.readiness_level}</h2>
            <p className="text-slate-600">Interview Readiness Score</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-bold mb-6">Skill Assessment</h3>
          {Object.entries(report.skill_scores).map(([skill, s]) => (
            <SkillBar key={skill} skill={skill} score={s} />
          ))}
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              <h3 className="text-xl font-bold">Strengths</h3>
            </div>
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm">{s}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 bg-rose-50 border-rose-200">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-6 h-6 text-rose-600" />
              <h3 className="text-xl font-bold">Weaknesses</h3>
            </div>
            <ul className="space-y-2">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <span className="text-sm">{w}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-6 h-6 text-blue-800" />
              <h3 className="text-xl font-bold">Recommendations</h3>
            </div>
            <ul className="space-y-2">
              {report.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-800">{i + 1}</span>
                  </div>
                  <span className="text-sm">{r}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="p-8 text-center bg-blue-50">
          <h3 className="text-2xl font-bold mb-3">Ready for Another Round?</h3>
          <p className="text-slate-600 mb-6">Take another mock interview to keep improving.</p>
          <Button onClick={() => navigate('/')} size="lg" className="bg-blue-800">
            Start New Interview<ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
