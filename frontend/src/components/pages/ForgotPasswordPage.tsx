import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import authService from '../../services/authService';
import { usePageTitle } from '../../hooks/usePageTitle';

export function ForgotPasswordPage() {
  usePageTitle('Forgot Password', 'Reset your CourtConnect account password by entering your email address.');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setStatus('idle');

    try {
      await authService.forgotPassword(email.trim());
      setStatus('success');
      setMessage(
        `If an account with that email exists, we've sent a password reset link. Please check your inbox (and spam folder).`
      );
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#98e209] pt-24 pb-8">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#010101] mb-2">Forgot Password</h1>
          <p className="text-[#010101] opacity-80">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl text-[#010101]">Reset your password</CardTitle>
          </CardHeader>

          <CardContent className="pt-4">
            {/* Success State */}
            {status === 'success' ? (
              <div className="text-center space-y-6 py-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-[#98e209]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#010101] mb-2">Check your email</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
                </div>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-[#98e209] text-[#010101] hover:bg-[#89cb08] py-3 rounded-full font-semibold"
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              /* Form State */
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error Banner */}
                {status === 'error' && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{message}</p>
                  </div>
                )}

                {/* Email Input */}
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your registered email"
                      className="pl-10"
                      required
                      autoFocus
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full bg-[#98e209] text-[#010101] hover:bg-[#89cb08] py-3 rounded-full font-semibold disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>

                {/* Back to Login */}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-[#010101] transition-colors mt-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
