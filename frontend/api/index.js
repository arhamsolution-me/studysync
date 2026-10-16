module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {}
  }
  body = body || {};

  const url = req.url || '';

  // Auth Login
  if (url.includes('/auth/login')) {
    const email = body.email || 'student@test.com';
    const name = email.split('@')[0] || 'Student';
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: 'ss-token-' + Date.now(),
        token: 'ss-token-' + Date.now(),
        user: {
          id: 'usr-student',
          fullName: name.charAt(0).toUpperCase() + name.slice(1),
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
      return res.status(200).json({
        success: true,
        data: {
          response: "Hello! I am your StudySync AI Tutor. I can help you review lecture slides, summarize chapters, answer questions grounded in your course materials, and generate revision quizzes.",
          sources: ["Lecture 1 Slides.pdf", "Syllabus Overview.pdf"]
        }
      });
    }

    if (req.method === 'POST') {
      const courseName = body.name || 'New Course';
      return res.status(201).json({
        success: true,
        data: {
          course: {
            id: 'c_' + Date.now(),
            name: courseName,
            code: 'CS' + Math.floor(100 + Math.random() * 900),
            colorTag: body.colorTag || '#3B82F6',
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
            title: body.title || 'New Task',
            course: body.course || 'Data Structures',
            dueDate: body.dueDate || new Date().toISOString(),
            status: 'pending',
            priority: body.priority || 'medium'
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
};
