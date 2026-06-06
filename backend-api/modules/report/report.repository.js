const data = require('../../services/data.service');
async function create(report) { return data.addReport(report); }
async function list() { return data.getReports(); }
async function setStatus(id, status) { return data.updateReportStatus(id, status); }
module.exports = { create, list, setStatus };
