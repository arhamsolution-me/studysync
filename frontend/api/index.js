async function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = await getBody(req);
    const url = req.url || '';

    // Auth Login
    if (url.includes('/auth/login')) {
      const email = body?.email || 'student@test.com';
      const name = (email.split('@')[0] || 'Student');
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken: 'ss-token-' + Date.now(),
          token: 'ss-token-' + Date.now(),
          user: {
            id: 'usr-student',
            fullName: formattedName,
            email: email.toLowerCase(),
            role: 'student',
            isOnboarded: true,
            isVerified: true,
            plan: 'pro'
          }
        }
      });
    }

    // Auth Me
    if (url.includes('/auth/me')) {
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: 'usr-student',
            fullName: 'Student',
            email: 'student@test.com',
            role: 'student',
            isOnboarded: true,
            isVerified: true,
            plan: 'pro',
            planInfo: {
              plan: 'pro',
              maxCourses: 10,
              currentCourses: 4,
              aiQuotaUsed: 5,
              aiQuotaTotal: 500
            }
          }
        }
      });
    }

    // Auth Refresh
    if (url.includes('/auth/refresh')) {
      return res.status(200).json({
        success: true,
        data: {
          accessToken: 'ss-token-' + Date.now()
        }
      });
    }

    // Courses
    if (url.includes('/courses')) {
      if (url.includes('/ai-quota')) {
        return res.status(200).json({
          success: true,
          data: {
            used: 5,
            total: 500,
            remaining: 495,
            plan: 'pro'
          }
        });
      }

      if (url.includes('/chat')) {
        const q = (body?.question || '').trim().toLowerCase();
        let answer = '';
        if (q === 'hy' || q === 'hi' || q === 'hello' || q === 'hey' || q === 'salam') {
          answer = "Hello! 👋 I am your **StudySync AI Academic Tutor**.\n\nI'm ready to help you with your courses! You can:\n- Ask questions about your lecture slides\n- Request summaries of complex topics\n- Generate practice exam quizzes\n- Ask for step-by-step problem solutions\n\nWhat topic would you like to review today?";
        } else if (q.includes('how are you') || q.includes('kese ho') || q.includes('kaise ho')) {
          answer = "I'm doing great, thank you for asking! 🚀 Ready to help you understand your coursework, prepare for quizzes, and study efficiently.\n\nWhich course or lecture topic are you studying right now?";
        } else if (q.length > 0) {
          answer = `### 📘 Academic Tutor Insights\n\nRegarding your question: **"${body?.question}"**\n\n1. **Core Concept:** Grounded in your enrolled course syllabus and foundational principles.\n2. **Key Takeaway:** Step-by-step problem breakdown and continuous review yield the best exam mastery.\n3. **Next Steps:** Would you like me to walk through a concrete example or test you with a quick 3-question quiz?`;
        } else {
          answer = "Hello! I am your StudySync AI Academic Tutor. How can I assist you with your studies today?";
        }

        return res.status(200).json({
          success: true,
          data: {
            answer: answer,
            response: answer,
            sources: [
              {
                filename: 'Lecture Slides - Key Concepts.pdf',
                text: 'Curriculum definitions, syllabus standards, and lecture problem sets.',
                score: 0.95
              },
              {
                filename: 'Study Guide & Revision Notes.pdf',
                text: 'Structured chapter summaries and essential exam formula sheets.',
                score: 0.90
              }
            ]
          }
        });
      }

      if (req.method === 'POST') {
        const courseName = body?.name || 'New Course';
        return res.status(201).json({
          success: true,
          data: {
            course: {
              id: 'c_' + Date.now(),
              name: courseName,
              code: 'CS' + Math.floor(100 + Math.random() * 900),
              colorTag: body?.colorTag || '#3B82F6',
              credits: 3,
              materials: []
            }
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          courses: [
            {
              id: 'c1',
              name: 'Data Structures & Algorithms',
              code: 'CS201',
              colorTag: '#3B82F6',
              credits: 4,
              materials: [
                { id: 'm1', title: 'Binary Trees & Graph Traversals.pdf', size: '2.4 MB' },
                { id: 'm2', title: 'Sorting & Dynamic Programming.pdf', size: '1.8 MB' }
              ]
            },
            {
              id: 'c2',
              name: 'Artificial Intelligence & ML',
              code: 'CS401',
              colorTag: '#8B5CF6',
              credits: 3,
              materials: [
                { id: 'm3', title: 'Neural Networks & Deep Learning.pdf', size: '4.1 MB' }
              ]
            },
            {
              id: 'c3',
              name: 'Database Management Systems',
              code: 'CS302',
              colorTag: '#10B981',
              credits: 3,
              materials: [
                { id: 'm4', title: 'Relational Algebra & Normalization.pdf', size: '3.0 MB' }
              ]
            },
            {
              id: 'c4',
              name: 'Computer Networks & Security',
              code: 'CS305',
              colorTag: '#F59E0B',
              credits: 3,
              materials: [
                { id: 'm5', title: 'TCP/IP & Cryptography Protocols.pdf', size: '2.9 MB' }
              ]
            }
          ]
        }
      });
    }

    // Tasks
    if (url.includes('/tasks')) {
      if (req.method === 'POST') {
        return res.status(201).json({
          success: true,
          data: {
            task: {
              id: 't_' + Date.now(),
              title: body?.title || 'New Task',
              course: body?.course || 'Data Structures',
              dueDate: body?.dueDate || new Date().toISOString(),
              status: 'pending',
              priority: body?.priority || 'medium'
            }
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          tasks: [
            {
              id: 't1',
              title: 'Review Graph Algorithms Lecture Slides',
              course: 'Data Structures & Algorithms',
              dueDate: new Date(Date.now() + 86400000).toISOString(),
              status: 'pending',
              priority: 'high'
            },
            {
              id: 't2',
              title: 'Complete Neural Network PyTorch Lab',
              course: 'Artificial Intelligence & ML',
              dueDate: new Date(Date.now() + 172800000).toISOString(),
              status: 'pending',
              priority: 'medium'
            },
            {
              id: 't3',
              title: 'SQL BCNF Normalization Assignment',
              course: 'Database Management Systems',
              dueDate: new Date(Date.now() - 43200000).toISOString(),
              status: 'done',
              priority: 'low'
            }
          ]
        }
      });
    }

    // Default fallback response
    return res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      data: {
        accessToken: 'ss-token-' + Date.now(),
        user: {
          id: 'usr-student',
          fullName: 'Student',
          email: 'student@test.com',
          role: 'student',
          isOnboarded: true,
          isVerified: true,
          plan: 'pro'
        }
      }
    });
  }
}
