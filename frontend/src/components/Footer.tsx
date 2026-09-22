import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#010101] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold mb-4 text-[#98e209]">CourtConnect</h3>
            <p className="text-gray-300 mb-4 max-w-md">
              Your premier destination for booking sports courts and facilities. 
              Find and reserve the perfect venue for your next game.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded" aria-label="Facebook">
                <Facebook className="h-6 w-6 text-gray-300 hover:text-[#98e209] cursor-pointer transition-colors" />
              </a>
              <a href="#" className="focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded" aria-label="Twitter">
                <Twitter className="h-6 w-6 text-gray-300 hover:text-[#98e209] cursor-pointer transition-colors" />
              </a>
              <a href="#" className="focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded" aria-label="Instagram">
                <Instagram className="h-6 w-6 text-gray-300 hover:text-[#98e209] cursor-pointer transition-colors" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4 text-[#98e209]">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-gray-300 hover:text-[#98e209] transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/find-court"
                  className="text-gray-300 hover:text-[#98e209] transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded"
                >
                  Find Courts
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-gray-300 hover:text-[#98e209] transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-[#98e209] transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded"
                >
                  Sign Up
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-4 text-[#98e209]">Contact Us</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-[#98e209]" />
                <span className="text-gray-300">+92 (317) 257-3517</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-[#98e209]" />
                <span className="text-gray-300">danialisrar09@gmail.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-[#98e209]" />
                <span className="text-gray-300">Scheme 33, Karachi, Pakistan</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © 2025 CourtConnect. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <button className="text-gray-400 hover:text-[#98e209] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded">
              Privacy Policy
            </button>
            <button className="text-gray-400 hover:text-[#98e209] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded">
              Terms of Service
            </button>
            <button className="text-gray-400 hover:text-[#98e209] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#98e209] rounded">
              Cookie Policy
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}