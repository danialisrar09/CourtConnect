import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Users,
  Target,
  Award,
  Clock,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { usePageTitle } from '../../hooks/usePageTitle';

export function AboutPage() {
  usePageTitle('About Us', 'Learn about CourtConnect - our mission to make sports venue booking easy, accessible and affordable for everyone.');
  const navigate = useNavigate();
  
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // WhatsApp Integration
    const phoneNumber = "923112544195";
    const text = `Name: ${contactForm.name}\nEmail: ${contactForm.email}\nSubject: ${contactForm.subject}\nMessage: ${contactForm.message}`;
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');

    setContactForm({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
  };

  const stats = [
    {
      icon: <Users className="h-8 w-8 text-[#98e209]" />,
      number: "10,000+",
      label: "Happy Customers",
    },
    {
      icon: <Target className="h-8 w-8 text-[#98e209]" />,
      number: "500+",
      label: "Sports Venues",
    },
    {
      icon: <Award className="h-8 w-8 text-[#98e209]" />,
      number: "50+",
      label: "Cities Covered",
    },
    {
      icon: <Clock className="h-8 w-8 text-[#98e209]" />,
      number: "24/7",
      label: "Customer Support",
    },
  ];

  const team = [
    {
      name: "Sarah Johnson",
      position: "CEO & Founder",
      image: "/logo-transparent.png",
      description:
        "Sports enthusiast with 15 years of experience in the sports industry.",
    },
    {
      name: "Mike Chen",
      position: "CTO",
      image: "/logo-transparent.png",
      description:
        "Tech leader passionate about creating seamless booking experiences.",
    },
    {
      name: "Emily Rodriguez",
      position: "Head of Operations",
      image: "/logo-transparent.png",
      description:
        "Operations expert ensuring smooth venue partnerships and customer service.",
    },
    {
      name: "David Kim",
      position: "Head of Marketing",
      image: "/logo-transparent.png",
      description:
        "Marketing strategist focused on connecting communities through sports.",
    },
  ];

  const values = [
    {
      title: "Accessibility",
      description:
        "Making sports accessible to everyone, everywhere, anytime.",
      icon: <Users className="h-12 w-12 text-[#98e209]" />,
    },
    {
      title: "Quality",
      description:
        "Partnering only with premium venues that meet our high standards.",
      icon: <Award className="h-12 w-12 text-[#98e209]" />,
    },
    {
      title: "Innovation",
      description:
        "Continuously improving our platform with cutting-edge technology.",
      icon: <Target className="h-12 w-12 text-[#98e209]" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-[#98e209] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-[#010101] mb-6">
              About CourtConnect
            </h1>
            <p className="text-xl text-[#010101] opacity-80 max-w-3xl mx-auto">
              We're on a mission to make sports more accessible
              by connecting players with the best venues in
              their area. Book your perfect court in just a few
              clicks.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold text-[#010101] mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-[#010101] mb-6">
                Our Story
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  CourtConnect was born from a simple
                  frustration: finding and booking sports venues
                  was unnecessarily complicated. As passionate
                  athletes ourselves, we experienced the pain of
                  calling multiple venues, dealing with busy
                  phone lines, and unclear availability.
                </p>
                <p>
                  In 2025, we decided to solve this problem. We
                  started with a vision to create the most
                  comprehensive and user-friendly platform for
                  sports venue booking. Today, we're proud to
                  serve thousands of players and hundreds of
                  venues.
                </p>
                <p>
                  Our platform connects sports enthusiasts with
                  premium venues, making it easier than ever to
                  find, book, and play at the best sports
                  facilities in your area.
                </p>
              </div>
              <Button
                onClick={() => navigate("/find-court")}
                className="mt-6 bg-[#98e209] text-[#010101] hover:bg-[#89cb08] px-8 py-6 text-lg rounded-full"
              >
                Start Booking Now
              </Button>
            </div>
            <div className="rounded-2xl shadow-lg w-full h-96 bg-[#010101] flex items-center justify-center overflow-hidden">
              <img
                src="/logo-transparent.png"
                alt="CourtConnect Logo"
                className="w-72 h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Our Values Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#010101] mb-4">
              Our Values
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              These core values guide everything we do and help
              us serve our community better
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <Card
                key={index}
                className="text-center p-6 hover:shadow-lg transition-shadow"
              >
                <CardContent className="pt-6">
                  <div className="flex justify-center mb-4">
                    {value.icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#010101] mb-3">
                    {value.title}
                  </h3>
                  <p className="text-gray-600">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#010101] mb-4">
              Meet Our Team
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Passionate sports enthusiasts and tech experts
              working to revolutionize sports booking
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <Card
                key={index}
                className="text-center overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative">
                  <ImageWithFallback
                    src={member.image}
                    alt={member.name}
                    className="w-full h-64 object-cover"
                  />
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-[#010101] mb-1">
                    {member.name}
                  </h3>
                  <p className="text-[#98e209] font-medium mb-3">
                    {member.position}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {member.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#010101] mb-4">
              Get in Touch
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Have questions or suggestions? We'd love to hear
              from you!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h3 className="text-2xl font-bold text-[#010101] mb-6">
                Contact Information
              </h3>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-[#98e209] bg-opacity-20 rounded-lg">
                    <Phone className="h-6 w-6 text-[#010101]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#010101]">
                      Phone
                    </p>
                    <p className="text-gray-600">
                      +92 (311) 254-4195
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-[#98e209] bg-opacity-20 rounded-lg">
                    <Mail className="h-6 w-6 text-[#010101]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#010101]">
                      Email
                    </p>
                    <p className="text-gray-600">
                      danialisrar09@gmail.com
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-[#98e209] bg-opacity-20 rounded-lg">
                    <MapPin className="h-6 w-6 text-[#010101]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#010101]">
                      Address
                    </p>
                    <p className="text-gray-600">
                      Scheme 33,
                      <br />
                      Karachi, Pakistan
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="text-lg font-bold text-[#010101] mb-4">
                  Business Hours
                </h4>
                <div className="space-y-2 text-gray-600">
                  <div className="flex justify-between">
                    <span>Monday - Friday</span>
                    <span>9:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span>10:00 AM - 4:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span>Closed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <Card className="justify-evenly">
              <CardHeader>
                <CardTitle className="text-[#010101] text-lg font-bold">Send us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="pb-2" htmlFor="name">
                        Name
                      </Label>
                      <Input
                        id="name"
                        value={contactForm.name}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label className="pb-2" htmlFor="email">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="pb-2" htmlFor="subject">
                      Subject
                    </Label>
                    <Input
                      id="subject"
                      value={contactForm.subject}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          subject: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label className="pb-2" htmlFor="message">
                      Message
                    </Label>
                    <Textarea
                      id="message"
                      rows={5}
                      value={contactForm.message}
                      onChange={(e) =>
                        setContactForm({
                          ...contactForm,
                          message: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#98e209] text-[#010101] hover:bg-[#89cb08] px-4 py-6 text-lg rounded-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#010101]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Start Playing?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of players who have found their
            perfect courts through SportBooking
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/find-court")}
              className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08] px-8 py-6 text-lg rounded-full"
            >
              Find Courts Now
            </Button>
            <Button
              onClick={() => navigate("/login")}
              className="bg-transparent text-white hover:bg-white hover:text-[#010101] px-8 py-6 text-lg rounded-full border-2 border-white"
            >
              Join Sports Booking
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}