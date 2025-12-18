const db = require('../config/db');


exports.analyticsPage = (req, res) => {
const queries = {
schools: 'SELECT COUNT(*) AS total FROM users WHERE role = "school"',
students: 'SELECT COUNT(*) AS total FROM students',
teachers: 'SELECT COUNT(*) AS total FROM teachers',
resources: 'SELECT COUNT(*) AS total FROM resources'
};


db.query(queries.schools, (e1, r1) => {
if (e1) throw e1;
db.query(queries.students, (e2, r2) => {
if (e2) throw e2;
db.query(queries.teachers, (e3, r3) => {
if (e3) throw e3;
db.query(queries.resources, (e4, r4) => {
if (e4) throw e4;
res.render('admin/analytics', {
stats: {
schools: r1[0].total,
students: r2[0].total,
teachers: r3[0].total,
resources: r4[0].total
}
});
});
});
});
});
};