import { Link } from 'react-router';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="font-semibold text-white">SustainabilitySignals</span>
            </Link>
            <p className="text-sm max-w-md">
              ESG market intelligence for informed investment decisions. Track sustainability signals, analyze company profiles, and stay ahead of ESG trends.
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Student-built project by Nikhil Reddy Gogu · Portfolio: <a className="underline hover:text-white" href="https://nikhil.chat">nikhil.chat</a> · LinkedIn: <a className="underline hover:text-white" href="https://linkedin.com/in/nikhilgogu">linkedin.com/in/nikhilgogu</a>
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              <li><Link to="/methodology" className="hover:text-white transition-colors">Methodology</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:gogunikhil@gmail.com" className="hover:text-white transition-colors">
                  gogunikhil@gmail.com
                </a>
              </li>
              <li>
                <a href="mailto:NikhilReddy.Gogu@student.ams.ac.be" className="hover:text-white transition-colors">
                  NikhilReddy.Gogu@student.ams.ac.be
                </a>
              </li>
              <li>
                <a href="https://nikhil.chat" className="hover:text-white transition-colors">
                  nikhil.chat
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm">
            © {currentYear} SustainabilitySignals. All rights reserved.
          </p>
          <p className="text-xs text-gray-500">
            Data sources: Mock data (demo) · Refinitiv + public sources (coming soon)
          </p>
        </div>
      </div>
    </footer>
  );
}
