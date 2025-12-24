// scripts/hash-existing-passwords.js
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306
};

async function hashExistingPasswords() {
    let connection;
    try {
        console.log('🔌 Đang kết nối database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Đã kết nối!\n');

        const [users] = await connection.query('SELECT id, email, password FROM users');
        console.log(`📊 Tìm thấy ${users.length} users\n`);

        let hashedCount = 0, skippedCount = 0;

        for (const user of users) {
            if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
                console.log(`⏭️  User ${user.email} - Đã hash, bỏ qua`);
                skippedCount++;
                continue;
            }

            console.log(`🔐 Đang hash password cho ${user.email}...`);
            const hashedPassword = await bcrypt.hash(user.password, 10);
            await connection.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
            console.log(`✅ Đã hash password cho ${user.email}`);
            hashedCount++;
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 KẾT QUẢ:');
        console.log(`   Tổng users: ${users.length}`);
        console.log(`   Đã hash: ${hashedCount}`);
        console.log(`   Bỏ qua: ${skippedCount}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Lỗi:', error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
}

hashExistingPasswords();
