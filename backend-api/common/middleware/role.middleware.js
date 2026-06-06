function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  return (req, res, next) => {
    const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || 'guest'];
    if (!userRoles.some((role) => allowed.includes(role))) {
      return res.status(403).json({ success: false, message: allowed.includes('admin') ? 'Bạn không có quyền quản trị nội dung.' : 'Bạn không có quyền thực hiện thao tác này', errorCode: 'FORBIDDEN_ROLE', errors: [] });
    }
    return next();
  };
}

function requirePermission(...permissions) {
  const allowed = permissions.flat().filter(Boolean);
  return (req, res, next) => {
    const userPermissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || 'guest'];
    if (userRoles.includes('admin') || userPermissions.some((permission) => allowed.includes(permission))) return next();
    return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này', errorCode: 'FORBIDDEN_PERMISSION', errors: [] });
  };
}

module.exports = { requireRole, requirePermission };
