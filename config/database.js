import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'lms_army',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(conn => {
    console.log('✅ Database connected');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database error:', err.message);
  });

export default pool;