import db from '../config/database.js';
import { getBranchFilter } from '../utils/branchHelper.js';

export const getAdmin = async (req, res, next) => {
  try {
    const branchId = getBranchFilter(req);
    const branchFilter = branchId ? ' AND branch_id = ?' : '';
    const branchClassFilter = branchId ? ' AND c.branch_id = ?' : '';
    const params = branchId ? [branchId] : [];

    // Stats with branch filter
    const [[students]] = await db.query(`SELECT COUNT(*) as total, SUM(status = 'active') as active FROM students WHERE 1=1${branchFilter}`, params);
    const [[classes]] = await db.query(`SELECT COUNT(*) as total, SUM(status = 'active') as active FROM classes WHERE 1=1${branchFilter}`, params);
    const [[trials]] = await db.query(`SELECT COUNT(*) as total, SUM(status = 'active') as active, SUM(status = 'converted') as converted FROM trial_students WHERE 1=1${branchFilter}`, params);
    const [[experiences]] = await db.query(`SELECT COUNT(*) as total, SUM(status = 'pending') as pending, SUM(scheduled_date = CURDATE()) as today FROM experience_schedules WHERE 1=1${branchFilter}`, params);

    // Sessions via class
    const [[sessions]] = await db.query(
      `SELECT COUNT(*) as total, SUM(s.session_date = CURDATE()) as today, SUM(s.attendance_submitted = 1) as submitted 
       FROM sessions s JOIN classes c ON s.class_id = c.id WHERE 1=1${branchClassFilter}`, params
    );

    // Users (no branch filter for admins viewing all)
    const [[teachers]] = await db.query("SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'TEACHER' AND u.is_active = 1");
    const [[cms]] = await db.query("SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'CM' AND u.is_active = 1");
    const [[sales]] = await db.query("SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'SALE' AND u.is_active = 1");
    const [[assignments]] = await db.query(`SELECT COUNT(*) as total FROM assignments a JOIN classes c ON a.class_id = c.id WHERE 1=1${branchClassFilter}`, params);

    // Branch stats
    const [branchStats] = await db.query(`SELECT * FROM v_branch_stats`);

    // Recent data with branch filter
    const [recentStudents] = await db.query(
      `SELECT id, full_name, student_code, created_at FROM students WHERE 1=1${branchFilter} ORDER BY created_at DESC LIMIT 5`, params
    );
    const [recentExperiences] = await db.query(
      `SELECT e.id, e.student_name, e.customer_phone, DATE_FORMAT(e.scheduled_date, '%Y-%m-%d') as scheduled_date, e.scheduled_time, e.status, s.name as subject_name, b.name as branch_name
       FROM experience_schedules e 
       LEFT JOIN subjects s ON e.subject_id = s.id 
       JOIN branches b ON e.branch_id = b.id
       WHERE 1=1${branchFilter.replace('branch_id', 'e.branch_id')}
       ORDER BY e.created_at DESC LIMIT 5`, params
    );
    const [todaySessions] = await db.query(
      `SELECT s.id, s.session_number, s.start_time, s.end_time, s.attendance_submitted, c.class_name, t.full_name as teacher_name, b.name as branch_name
       FROM sessions s 
       JOIN classes c ON s.class_id = c.id 
       JOIN branches b ON c.branch_id = b.id
       LEFT JOIN users t ON c.teacher_id = t.id
       WHERE s.session_date = CURDATE()${branchClassFilter} ORDER BY b.name, s.start_time LIMIT 10`, params
    );
    const [recentTrials] = await db.query(
      `SELECT t.id, t.full_name, t.parent_phone, t.sessions_attended, t.max_sessions, t.status, s.name as subject_name, b.name as branch_name
       FROM trial_students t 
       LEFT JOIN subjects s ON t.subject_id = s.id
       JOIN branches b ON t.branch_id = b.id
       WHERE t.status = 'active'${branchFilter.replace('branch_id', 't.branch_id')} ORDER BY t.created_at DESC LIMIT 5`, params
    );

    res.json({
      success: true,
      data: {
        students, classes, teachers: teachers.total, cms: cms.total, sales: sales.total,
        trials, experiences, sessions, assignments: assignments.total, branchStats,
        recentStudents, recentExperiences, todaySessions, recentTrials
      }
    });
  } catch (error) { next(error); }
};

export const getSale = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const branchId = getBranchFilter(req);
    const branchFilter = branchId ? ' AND branch_id = ?' : '';
    const baseParams = [userId];
    const params = branchId ? [userId, branchId] : [userId];

    const [[students]] = await db.query(`SELECT COUNT(*) as total, SUM(status = 'active') as active FROM students WHERE sale_id = ?${branchFilter}`, params);
    const [[experiences]] = await db.query(
      `SELECT COUNT(*) as total, SUM(status = 'pending') as pending, SUM(status = 'completed') as completed, SUM(status = 'converted') as converted, SUM(scheduled_date = CURDATE()) as today
       FROM experience_schedules WHERE sale_id = ?${branchFilter}`, params
    );
    const [[trials]] = await db.query(`SELECT COUNT(*) as total, SUM(status = 'active') as active, SUM(status = 'converted') as converted FROM trial_students WHERE sale_id = ?${branchFilter}`, params);

    const [todayExperiences] = await db.query(
      `SELECT e.id, e.student_name, e.customer_name, e.customer_phone, e.scheduled_time, e.status, s.name as subject_name, b.name as branch_name
       FROM experience_schedules e 
       LEFT JOIN subjects s ON e.subject_id = s.id
       JOIN branches b ON e.branch_id = b.id
       WHERE e.sale_id = ? AND e.scheduled_date = CURDATE()${branchFilter} ORDER BY e.scheduled_time`, params
    );
    const [activeTrials] = await db.query(
      `SELECT t.id, t.full_name, t.parent_phone, t.sessions_attended, t.max_sessions, s.name as subject_name, b.name as branch_name
       FROM trial_students t 
       LEFT JOIN subjects s ON t.subject_id = s.id
       JOIN branches b ON t.branch_id = b.id
       WHERE t.sale_id = ? AND t.status = 'active'${branchFilter} ORDER BY t.created_at DESC LIMIT 10`, params
    );
    const [recentExperiences] = await db.query(
      `SELECT e.id, e.student_name, DATE_FORMAT(e.scheduled_date, '%Y-%m-%d') as scheduled_date, e.scheduled_time, e.status, b.name as branch_name
       FROM experience_schedules e 
       JOIN branches b ON e.branch_id = b.id
       WHERE e.sale_id = ?${branchFilter} ORDER BY e.created_at DESC LIMIT 5`, params
    );

    res.json({ success: true, data: { students, experiences, trials, todayExperiences, activeTrials, recentExperiences } });
  } catch (error) { next(error); }
};

export const getTeacher = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const branchId = getBranchFilter(req);
    const branchFilter = branchId ? ' AND c.branch_id = ?' : '';
    const params = branchId ? [userId, branchId] : [userId];
    const params2 = branchId ? [userId, userId, branchId] : [userId, userId];

    const [classes] = await db.query(
      `SELECT c.id, c.class_name, c.class_code, c.study_days, c.start_time, c.end_time, s.name as subject_name, l.name as level_name, b.name as branch_name,
              (SELECT COUNT(*) FROM class_students WHERE class_id = c.id AND status = 'active') as student_count
       FROM classes c
       LEFT JOIN subjects s ON c.subject_id = s.id
       LEFT JOIN levels l ON c.level_id = l.id
       JOIN branches b ON c.branch_id = b.id
       WHERE c.teacher_id = ? AND c.status = 'active'${branchFilter}`, params
    );
    const [todaySessions] = await db.query(
      `SELECT s.id, s.session_number, s.start_time, s.end_time, s.attendance_submitted, c.class_name, c.id as class_id, b.name as branch_name,
              (SELECT COUNT(*) FROM class_students WHERE class_id = c.id AND status = 'active') as student_count
       FROM sessions s
       JOIN classes c ON s.class_id = c.id
       JOIN branches b ON c.branch_id = b.id
       WHERE (c.teacher_id = ? OR s.substitute_teacher_id = ?) AND s.session_date = CURDATE()${branchFilter}
       ORDER BY s.start_time`, params2
    );

    const statsParams = branchId ? [userId, branchId, userId, branchId, userId, branchId, userId, branchId] : [userId, userId, userId, userId];
    const [[stats]] = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM classes c WHERE teacher_id = ? AND status = 'active'${branchFilter}) as total_classes,
        (SELECT COUNT(DISTINCT cs.student_id) FROM class_students cs JOIN classes c ON cs.class_id = c.id WHERE c.teacher_id = ? AND cs.status = 'active'${branchFilter}) as total_students,
        (SELECT COUNT(*) FROM sessions s JOIN classes c ON s.class_id = c.id WHERE c.teacher_id = ? AND s.session_date = CURDATE()${branchFilter}) as today_sessions,
        (SELECT COUNT(*) FROM assignments a JOIN classes c ON a.class_id = c.id WHERE c.teacher_id = ?${branchFilter}) as total_assignments
      `, statsParams
    );

    const [pendingAttendance] = await db.query(
      `SELECT s.id, s.session_number, DATE_FORMAT(s.session_date, '%Y-%m-%d') as session_date, c.class_name, b.name as branch_name
       FROM sessions s 
       JOIN classes c ON s.class_id = c.id
       JOIN branches b ON c.branch_id = b.id
       WHERE c.teacher_id = ? AND s.attendance_submitted = 0 AND s.session_date <= CURDATE()${branchFilter}
       ORDER BY s.session_date DESC LIMIT 5`, params
    );

    res.json({ success: true, data: { classes, todaySessions, stats, pendingAttendance } });
  } catch (error) { next(error); }
};

export const getCM = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const branchId = getBranchFilter(req);
    const branchFilter = branchId ? ' AND c.branch_id = ?' : '';
    const params = branchId ? [userId, branchId] : [userId];

    const [classes] = await db.query(
      `SELECT c.id, c.class_name, c.class_code, c.study_days, c.start_time, s.name as subject_name, t.full_name as teacher_name, b.name as branch_name,
              (SELECT COUNT(*) FROM class_students WHERE class_id = c.id AND status = 'active') as student_count
       FROM classes c
       LEFT JOIN subjects s ON c.subject_id = s.id
       LEFT JOIN users t ON c.teacher_id = t.id
       JOIN branches b ON c.branch_id = b.id
       WHERE c.cm_id = ? AND c.status = 'active'${branchFilter}`, params
    );

    const statsParams = branchId ? [userId, branchId, userId, branchId] : [userId, userId];
    const [[stats]] = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM classes c WHERE cm_id = ? AND status = 'active'${branchFilter}) as total_classes,
        (SELECT COUNT(DISTINCT cs.student_id) FROM class_students cs JOIN classes c ON cs.class_id = c.id WHERE c.cm_id = ? AND cs.status = 'active'${branchFilter}) as total_students
      `, statsParams
    );

    const [todaySessions] = await db.query(
      `SELECT s.id, s.session_number, s.start_time, s.end_time, s.attendance_submitted, c.class_name, t.full_name as teacher_name, b.name as branch_name
       FROM sessions s
       JOIN classes c ON s.class_id = c.id
       JOIN branches b ON c.branch_id = b.id
       LEFT JOIN users t ON c.teacher_id = t.id
       WHERE c.cm_id = ? AND s.session_date = CURDATE()${branchFilter}
       ORDER BY s.start_time`, params
    );
    const [pendingAttendance] = await db.query(
      `SELECT s.id, s.session_number, DATE_FORMAT(s.session_date, '%Y-%m-%d') as session_date, c.class_name, t.full_name as teacher_name, b.name as branch_name
       FROM sessions s 
       JOIN classes c ON s.class_id = c.id 
       JOIN branches b ON c.branch_id = b.id
       LEFT JOIN users t ON c.teacher_id = t.id
       WHERE c.cm_id = ? AND s.attendance_submitted = 0 AND s.session_date <= CURDATE()${branchFilter}
       ORDER BY s.session_date DESC LIMIT 10`, params
    );

    res.json({ success: true, data: { classes, stats, todaySessions, pendingAttendance } });
  } catch (error) { next(error); }
};