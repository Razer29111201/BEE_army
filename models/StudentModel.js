import BaseModel from './BaseModel.js';

class StudentModel extends BaseModel {
  constructor() {
    super('students');
  }

  generateCode(branchCode = 'HS') {
    return branchCode + '-' + Date.now().toString(36).toUpperCase();
  }

  async findAllWithRelations({ status, subjectId, search, saleId, branchId, page = 1, limit = 20 } = {}) {
    let sql = `
      SELECT s.*, b.name as branch_name, b.code as branch_code,
             sub.name as subject_name, l.name as level_name, u.full_name as sale_name,
             (SELECT c.class_name FROM class_students cs JOIN classes c ON cs.class_id = c.id 
              WHERE cs.student_id = s.id AND cs.status = 'active' LIMIT 1) as class_name
      FROM students s
      JOIN branches b ON s.branch_id = b.id
      LEFT JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN levels l ON s.level_id = l.id
      LEFT JOIN users u ON s.sale_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (branchId) { sql += ' AND s.branch_id = ?'; params.push(branchId); }
    if (saleId) { sql += ' AND s.sale_id = ?'; params.push(saleId); }
    if (status) { sql += ' AND s.status = ?'; params.push(status); }
    if (subjectId) { sql += ' AND s.subject_id = ?'; params.push(subjectId); }
    if (search) {
      sql += ' AND (s.full_name LIKE ? OR s.student_code LIKE ? OR s.parent_phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countSql = sql.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM');
    const [countRows] = await this.db.query(countSql, params);
    const total = countRows[0]?.total || 0;

    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(+limit, (+page - 1) * +limit);
    const [rows] = await this.db.query(sql, params);

    return { data: rows, pagination: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findByIdWithRelations(id) {
    const [rows] = await this.db.query(
      `SELECT s.*, b.name as branch_name, b.code as branch_code,
              sub.name as subject_name, l.name as level_name, u.full_name as sale_name
       FROM students s
       JOIN branches b ON s.branch_id = b.id
       LEFT JOIN subjects sub ON s.subject_id = sub.id
       LEFT JOIN levels l ON s.level_id = l.id
       LEFT JOIN users u ON s.sale_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async getStats(saleId = null, branchId = null) {
    let sql = `SELECT COUNT(*) as total,
      SUM(status = 'active') as active,
      SUM(status = 'paused') as paused,
      SUM(status = 'finished') as finished
      FROM students WHERE 1=1`;
    const params = [];
    if (branchId) { sql += ' AND branch_id = ?'; params.push(branchId); }
    if (saleId) { sql += ' AND sale_id = ?'; params.push(saleId); }
    const [rows] = await this.db.query(sql, params);
    return rows[0];
  }

  async findByClass(classId) {
    const [rows] = await this.db.query(
      `SELECT s.*, cs.status as enrollment_status
       FROM students s
       JOIN class_students cs ON s.id = cs.student_id
       WHERE cs.class_id = ? AND cs.status = 'active'
       ORDER BY s.full_name`,
      [classId]
    );
    return rows;
  }
}

export default new StudentModel();