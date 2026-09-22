import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, User, Building } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LoadingButton } from '../ui/loading';
import { useAuth } from '../../contexts';
import { usePageTitle } from '../../hooks/usePageTitle';
import { loginSchema, signupSchema, type LoginFormData, type SignupFormData } from '../../lib/validations';
import { authService } from '../../services';

export function LoginPage() {
  usePageTitle('Login', 'Sign in to CourtConnect to book venues, manage your reservations, or list your sports facilities.');
  const navigate = useNavigate();
  const { login, isAuthenticated, userType } = useAuth();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (isAuthenticated && userType) {
      const dashboardPath = userType === 'customer' ? '/dashboard/customer' : '/dashboard/business';
      navigate(dashboardPath, { replace: true });
    }
  }, [isAuthenticated, userType, navigate]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<'customer' | 'business'>('customer');
  const [selectedSignupRoles, setSelectedSignupRoles] = useState<Set<'customer' | 'business'>>(new Set(['customer']));

  // Login form
  const {
    register: registerLogin,
    handleSubmit: handleSubmitLogin,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  // Signup form
  const {
    register: registerSignup,
    handleSubmit: handleSubmitSignup,
    formState: { errors: signupErrors, isSubmitting: isSignupSubmitting },
    setValue: setSignupValue,
    watch: watchSignup,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: {
      userType: 'customer',
      terms: false,
    },
  });

  const onLoginSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password, selectedUserType);
      toast.success('Welcome back! Login successful.');
      navigate(selectedUserType === 'customer' ? '/dashboard/customer' : '/dashboard/business');
    } catch (error: any) {
      console.error('Login error:', error);
      // Show specific error message for role mismatch
      if (error.message && error.message.includes('registered as')) {
        toast.error(error.message, { duration: 5000 });
      } else {
        toast.error(error.message || 'Login failed. Please check your credentials.');
      }
    }
  };

  const onSignupSubmit = async (data: SignupFormData) => {
    try {
      // First register the user with the backend
      await authService.register({
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        profileType: data.userType,
      });
      
      // Then log them in - for 'both' role, default to customer
      const loginRole = data.userType === 'both' ? 'customer' : data.userType;
      await login(data.email, data.password, loginRole);
      toast.success(`Welcome to CourtConnect, ${data.name}!`);
      navigate(loginRole === 'customer' ? '/dashboard/customer' : '/dashboard/business');
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Signup failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#98e209] pt-24 pb-8">
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#010101] mb-2">Welcome Back</h1>
          <p className="text-[#010101] opacity-80">Sign in to your account or create a new one</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-[#010101]">Get Started</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="data-[state=active]:bg-[#98e209]">Login</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-[#98e209]">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSubmitLogin(onLoginSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedUserType('customer')}
                        className={`p-4 rounded-lg border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] ${
                          selectedUserType === 'customer'
                            ? 'border-[#98e209] bg-[#98e209] bg-opacity-20'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <User className="h-6 w-6 mx-auto mb-2" />
                        <div className="font-semibold">Customer</div>
                        <div className="text-xs text-gray-500">Book sports venues</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUserType('business')}
                        className={`p-4 rounded-lg border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] ${
                          selectedUserType === 'business'
                            ? 'border-[#98e209] bg-[#98e209] bg-opacity-20'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Building className="h-6 w-6 mx-auto mb-2" />
                        <div className="font-semibold">Business</div>
                        <div className="text-xs text-gray-500">List your venues</div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        {...registerLogin('email')}
                        className={`pl-10 ${loginErrors.email ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {loginErrors.email && (
                      <p className="text-sm text-red-500">{loginErrors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        {...registerLogin('password')}
                        className={`pl-10 pr-10 ${loginErrors.password ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <p className="text-sm text-red-500">{loginErrors.password.message}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-sm text-gray-600">Remember me</span>
                    </label>
                    <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-[#98e209] hover:underline focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded">
                      Forgot password?
                    </button>
                  </div>

                  <LoadingButton 
                    type="submit" 
                    className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 bg-[#98e209] text-[#010101] hover:bg-[#89cb08] py-3"
                    isLoading={isLoginSubmitting}
                    loadingText="Signing in..."
                  >
                    Sign In
                  </LoadingButton>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSubmitSignup(onSignupSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Enter your full name"
                        {...registerSignup('name')}
                        className={`pl-10 ${signupErrors.name ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {signupErrors.name && (
                      <p className="text-sm text-red-500">{signupErrors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email"
                        {...registerSignup('email')}
                        className={`pl-10 ${signupErrors.email ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {signupErrors.email && (
                      <p className="text-sm text-red-500">{signupErrors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <p className="text-xs text-gray-500 mb-2">Select one or both roles</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          const newRoles = new Set(selectedSignupRoles);
                          if (newRoles.has('customer')) {
                            newRoles.delete('customer');
                          } else {
                            newRoles.add('customer');
                          }
                          setSelectedSignupRoles(newRoles);
                          
                          // Update form value
                          if (newRoles.size === 2) {
                            setSignupValue('userType', 'both');
                          } else if (newRoles.has('customer')) {
                            setSignupValue('userType', 'customer');
                          } else if (newRoles.has('business')) {
                            setSignupValue('userType', 'business');
                          } else {
                            setSignupValue('userType', 'customer');
                            newRoles.add('customer');
                            setSelectedSignupRoles(newRoles);
                          }
                        }}
                        className={`p-4 rounded-lg border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] ${
                          selectedSignupRoles.has('customer')
                            ? 'border-[#98e209] bg-[#98e209] bg-opacity-20'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <User className="h-6 w-6 mx-auto mb-2" />
                        <div className="font-medium">Customer</div>
                        <div className="text-sm text-gray-600">Book courts</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newRoles = new Set(selectedSignupRoles);
                          if (newRoles.has('business')) {
                            newRoles.delete('business');
                          } else {
                            newRoles.add('business');
                          }
                          setSelectedSignupRoles(newRoles);
                          
                          // Update form value
                          if (newRoles.size === 2) {
                            setSignupValue('userType', 'both');
                          } else if (newRoles.has('customer')) {
                            setSignupValue('userType', 'customer');
                          } else if (newRoles.has('business')) {
                            setSignupValue('userType', 'business');
                          } else {
                            setSignupValue('userType', 'customer');
                            newRoles.add('customer');
                            setSelectedSignupRoles(newRoles);
                          }
                        }}
                        className={`p-4 rounded-lg border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] ${
                          selectedSignupRoles.has('business')
                            ? 'border-[#98e209] bg-[#98e209] bg-opacity-20'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Building className="h-6 w-6 mx-auto mb-2" />
                        <div className="font-medium">Business</div>
                        <div className="text-sm text-gray-600">List venues</div>
                      </button>
                    </div>
                    {selectedSignupRoles.size === 2 && (
                      <p className="text-xs text-[#98e209] font-medium">✓ Both roles selected - You can switch between Customer and Business views</p>
                    )}
                    {signupErrors.userType && (
                      <p className="text-sm text-red-500">{signupErrors.userType.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        {...registerSignup('password')}
                        className={`pl-10 pr-10 ${signupErrors.password ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {signupErrors.password && (
                      <p className="text-sm text-red-500">{signupErrors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        {...registerSignup('confirmPassword')}
                        className={`pl-10 pr-10 ${signupErrors.confirmPassword ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 focus:outline-none"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {signupErrors.confirmPassword && (
                      <p className="text-sm text-red-500">{signupErrors.confirmPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start">
                      <input 
                        type="checkbox" 
                        id="terms" 
                        {...registerSignup('terms')}
                        className="mr-2 mt-1" 
                      />
                      <label htmlFor="terms" className="text-sm text-gray-600">
                        I agree to the{' '}
                        <button type="button" className="text-[#98e209] hover:underline focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded">
                          Terms & Conditions
                        </button>
                      </label>
                    </div>
                    {signupErrors.terms && (
                      <p className="text-sm text-red-500">{signupErrors.terms.message}</p>
                    )}
                  </div>

                  <LoadingButton 
                    type="submit" 
                    className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 bg-[#98e209] text-[#010101] hover:bg-[#89cb08] py-3"
                    isLoading={isSignupSubmitting}
                    loadingText="Creating account..."
                  >
                    Create Account
                  </LoadingButton>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <button 
                  onClick={() => navigate('/')}
                  className="text-[#98e209] hover:underline focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-2 rounded"
                >
                  Go back to home
                </button>
              </p>
            </div>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}