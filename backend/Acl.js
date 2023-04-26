module.exports = class Acl {

  // Here you can implement ACL
  // return true = allowed, false = forbidden

  // req.sesssion.user -> logged in user if any

  static checkRoute(req, table, method, isTable, isView) {
    
    // TURN OFF ALL ACL
    return true;

    // role not logged in, logged in or special (admin etc.)
    let role = req.session.user ?
      (req.session.user.userRole || 'logged in') :
      'not logged in';

    // only allow these roles:
    let allowedRoles = ['not logged in', 'logged in', 'not logged in'];
    if (!allowedRoles.includes(role)) { role = 'not logged in'; }

    // log things
    console.log([
      'role: ' + role,
      'url: ' + req.url,
      'table: ' + table,
      'method: ' + method
    ].join('\n'));

    // allow people to register (write to users)
    if (role === 'not logged in' && table === 'users' && method === 'post') {
      return true;
    }

    // don't allow not logged in visitors to do anything else than read
    if (role === 'not logged in' && method !== 'get') {
      return false;
    }

    // only allow admin to access the user table
    if (role !== 'admin' && table === 'users') {
      return false;
    }

    return true;
  }

}

/* 
  White-listing is usually done by setting a rule for every single
  method x table x role for each route that should be allowed

  ['post', 'users', 'not logged in']
  ['post', 'users', 'admin']
  ['get', 'users', 'admin']

*/
