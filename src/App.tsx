import { BrowserRouter as Router, Routes, Route } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { Layout } from './components/layout';
import { Landing, Dashboard, Company, About, Methodology, Reports, NotFound } from './pages';


export default function App() {
  return (
    <HelmetProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            {/* Main Pages */}
            <Route index element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/company/:ticker" element={<Company />} />
            <Route path="/about" element={<About />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/reports" element={<Reports />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
    </HelmetProvider>
  );
}
