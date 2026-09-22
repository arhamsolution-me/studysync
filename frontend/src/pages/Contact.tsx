import React, { useState } from 'react';
import toast from 'react-hot-toast';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import {
  Mail,
  Smartphone,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'Technical Support',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      toast.success('Your message has been received! Our academic support team will respond shortly.');
      setFormData({
        name: '',
        email: '',
        category: 'Technical Support',
        subject: '',
        message: '',
      });
    }, 1000);
  };

  return (
    <div className="ss-landing-page">
      <PublicHeader />

      {/* Hero Section */}
      <section className="ss-page-hero">
        <div className="ss-edu-container" style={{ textAlign: 'center' }}>
          <div className="ss-edu-hero-tag">
            <MessageSquare size={14} color="#4F46E5" />
            <span>Campus Support & Inquiries</span>
          </div>

          <h1 className="ss-page-hero-title">
            We're Here to Help <br />
            <span className="ss-edu-highlight">Your Academic Journey</span>
          </h1>

          <p className="ss-page-hero-subtitle">
            Need help configuring WhatsApp Baileys, have questions regarding your isolated tenant, or want to bring StudySync to your university society?
          </p>
        </div>
      </section>

      {/* Split Contact Section */}
      <section className="ss-contact-section">
        <div className="ss-edu-container">
          <div className="ss-contact-grid">
            {/* Left: Contact Info & Channels */}
            <div className="ss-contact-info-card">
              <div>
                <div className="ss-edu-section-tag">Direct Channels</div>
                <h2 className="ss-contact-title">Connect with Our Team</h2>
                <p className="ss-contact-desc">
                  Our engineering and academic team responds to all student inquiries within 2 to 4 business hours.
                </p>

                <div className="ss-contact-channels-list">
                  <div className="ss-contact-channel-item">
                    <div className="ss-channel-icon" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                      <Mail size={22} />
                    </div>
                    <div>
                      <div className="ss-channel-label">Email Support</div>
                      <a href="mailto:support@studysync.ai" className="ss-channel-value">
                        support@studysync.ai
                      </a>
                    </div>
                  </div>

                  <div className="ss-contact-channel-item">
                    <div className="ss-channel-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                      <Smartphone size={22} />
                    </div>
                    <div>
                      <div className="ss-channel-label">WhatsApp Campus Desk</div>
                      <span className="ss-channel-value">
                        +92 300 0000000 (Live Student Desk)
                      </span>
                    </div>
                  </div>

                  <div className="ss-contact-channel-item">
                    <div className="ss-channel-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                      <Clock size={22} />
                    </div>
                    <div>
                      <div className="ss-channel-label">Operating Hours</div>
                      <span className="ss-channel-value">
                        Monday – Saturday: 9:00 AM – 11:00 PM PKT
                      </span>
                    </div>
                  </div>

                  <div className="ss-contact-channel-item">
                    <div className="ss-channel-icon" style={{ background: '#FFFBEB', color: '#D97706' }}>
                      <MapPin size={22} />
                    </div>
                    <div>
                      <div className="ss-channel-label">Campus Hubs</div>
                      <span className="ss-channel-value">
                        Lahore, Islamabad & Karachi University Circles
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Campus Ambassador Box */}
              <div className="ss-ambassador-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Sparkles size={16} color="#4F46E5" />
                  <strong style={{ color: '#0F172A', fontSize: '0.925rem' }}>Campus Ambassador Program</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5 }}>
                  Are you a student leader or society president? Lead the StudySync AI chapter at your university and unlock free lifetime Pro access and stipend opportunities.
                </p>
              </div>
            </div>

            {/* Right: Interactive Contact Form */}
            <div className="ss-contact-form-card">
              {isSuccess ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#166534' }}>
                    <CheckCircle size={36} />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px' }}>
                    Message Sent Successfully!
                  </h3>
                  <p style={{ color: '#64748B', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 24px' }}>
                    Thank you for reaching out. We have logged your ticket and an academic advisor will email you back shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSuccess(false)}
                    className="ss-landing-btn-cta"
                  >
                    <span>Send Another Message</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="ss-contact-form">
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800, color: '#0F172A' }}>
                    Send Us a Message
                  </h3>
                  <p style={{ margin: '0 0 24px', color: '#64748B', fontSize: '0.9rem' }}>
                    Fill in the form below and we will get back to you promptly.
                  </p>

                  <div className="ss-form-row">
                    <div className="ss-form-field">
                      <label className="ss-form-label">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ali Ahmed"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="ss-form-input"
                      />
                    </div>
                    <div className="ss-form-field">
                      <label className="ss-form-label">University Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. ali@university.edu.pk"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="ss-form-input"
                      />
                    </div>
                  </div>

                  <div className="ss-form-row">
                    <div className="ss-form-field">
                      <label className="ss-form-label">Inquiry Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="ss-form-select"
                      >
                        <option value="Technical Support">Technical Support (RAG & NLP)</option>
                        <option value="WhatsApp Integration">WhatsApp Baileys Integration</option>
                        <option value="Campus Ambassador">Campus Ambassador Program</option>
                        <option value="Billing & Subscriptions">Billing & Subscriptions</option>
                        <option value="Feature Request">Feature Request / Feedback</option>
                      </select>
                    </div>
                    <div className="ss-form-field">
                      <label className="ss-form-label">Subject</label>
                      <input
                        type="text"
                        placeholder="e.g. Question about CS-402 indexing"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="ss-form-input"
                      />
                    </div>
                  </div>

                  <div className="ss-form-field">
                    <label className="ss-form-label">Your Message *</label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Describe your question, request, or feedback..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="ss-form-textarea"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="ss-form-submit-btn"
                  >
                    {isSubmitting ? (
                      <span>Submitting...</span>
                    ) : (
                      <>
                        <Send size={16} />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
