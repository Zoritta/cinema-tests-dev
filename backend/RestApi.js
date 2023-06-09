// © Thomas Frank, Node Hill
// MIT licensed
// A generic REST api

// Note: Do NOT use in production before you
// write logic that limits access in  tHE Acl.js file :)

const crypto = require('crypto');
const { passwordSalt } = require('../settings.json');

const Acl = require('./Acl');
const Login = require('./Login');

const db = require('./DatabaseQueryer');
db.verbose = false; // set to true to log db queries

module.exports = class RestApi {

  constructor(expressApp) {
    this.app = expressApp;
    this.handleRequestBodyJsonErrors();
    Login.addLoginRoutes(this.app);
    this.createRouter();
  }

  handleRequestBodyJsonErrors() {
    this.app.use((error, req, res, next) =>
      error instanceof SyntaxError ?
        res.status(400) && res.json({ error }) :
        next()
    );
  }

  async tablesAndViews() {
    return (await db.query('SHOW FULL TABLES'))
      .map(x => Object.values(x))
      .map(([name, type]) => ({
        name,
        type: type.includes('VIEW') ? 'view' : 'table'
      }));
  }

  async isTable(checkName) {
    return !!(await this.tablesAndViews()).find(({ name, type }) =>
      name === checkName && type === 'table');
  }

  async isView(checkName) {
    return !!(await this.tablesAndViews()).find(({ name, type }) =>
      name === checkName && type === 'view');
  }

  async runQuery(res, sql, params) {
    let error, result = await db.query(sql, params).catch(err => error = err);
    if (error) { res.status(400); delete error.sql; result = { error }; }
    return result;
  }

  createRouter() {
    let run = (req, res) => this.route(req, res);
    this.app.all('/api/:tableOrView', run);
    this.app.all('/api/:tableOrView/:id', run);
  }

  async route(req, res) {
    let { tableOrView: name, id } = req.params;
    let method = req.method.toLowerCase();
    method = method === 'patch' ? 'put' : method;
    let isTable = await this.isTable(name);
    let isView = await this.isView(name);
    // call ACL check
    if (!Acl.checkRoute(req, name, method, isTable, isView)) {
      res.status(403);
      res.json({ error: `Forbidden.` })
      return;
    }
    // errors - wrong table/view name or wrong request metod
    if (!isTable && !isView) {
      res.status(404);
      res.json({ error: `${name} is not a table or view.` })
    }
    else if (isTable && !['get', 'post', 'put', 'delete'].includes(method)) {
      res.status(405);
      res.json({ error: `${method}-method not allowed on table ${name}.` })
    }
    else if (isView && method !== 'get') {
      res.status(405);
      res.json({ error: `${method}-method not allowed on table ${name}.` })
    }
    // go ahead
    else {
      this[method](name, id, req, res);
    }
  }

  async get(tableName, id, req, res) {
    id = !isNaN(+id) ? id : null;
    let [urlQueryParams, ors] = this.parseUrlQueryParams(req.url);
    let { sort, limit, offset } = urlQueryParams;
    ['sort', 'limit', 'offset']
      .forEach(x => delete urlQueryParams[x]);
    if (offset && !limit) { limit = 1000000000 }
    sort = !sort ? sort : sort.split(',').map(x =>
      x[0] === '-' ? x.slice(1) + ' DESC' : x);
    id && (urlQueryParams = { id });
    let [where, whereVals] = this.whereFromParams(urlQueryParams, ors);
    let result = await this.runQuery(res,
      `
        SELECT * FROM ${tableName} 
        ${where ? `WHERE ${where}` : ''}
        ${sort ? ` ORDER BY ${sort}` : ''}
        ${limit ? ` LIMIT ${limit}` : ''}
        ${offset ? ` OFFSET ${offset}` : ''}
      `,
      [
        ...(where ? whereVals : []),
        // ...(limit ? [limit] : []),
        // ...(offset ? [offset] : []),
      ]
    );
    if (id !== null && result.length === 0) { res.status(404); }
    res.json(id !== null ? result[0] || null : result);
  }

  async post(tableName, id, req, res) {
    let body = req.body;
    tableName === 'users' && (body.password = this.encryptPassword(body.password));
    if (id || body.id) {
      res.status(400);
      res.json({ error: 'Do not use id:s with post requests!' });
      return;
    }
    let sql = `
      INSERT INTO ${tableName} (${Object.keys(body)})
      VALUES (${Object.keys(body).map(x => '?')})  
    `;
    res.json(await this.runQuery(res, sql, Object.values(body)));
  }

  async put(tableName, id, req, res) {
    let body = req.body;
    tableName === 'users' && body.password
      && (body.password = this.encryptPassword(body.password));
    if (!id) {
      res.status(400);
      res.json({ error: 'You must provide an id in the URL with put requests!' });
      return;
    }
    if (body.id) {
      res.status(400);
      res.json({ error: 'You should not provide an id in the request body!' });
      return;
    }
    let sql = `
      UPDATE ${tableName} 
      SET ${Object.keys(body).map(x => x + ' = ?')}
      WHERE id = ?
    `;
    res.json(await this.runQuery(res, sql,
      [...Object.values(body), id]));
  }

  async delete(tableName, id, req, res) {
    if (!id) {
      res.status(400);
      res.json({ error: 'You must provide an id in the URL with delete requests!' });
      return;
    }
    let sql = `
      DELETE FROM ${tableName}
      WHERE id = ?
    `;
    res.json(await this.runQuery(res, sql, [id]));
  }

  parseUrlQueryParams(url) {
    // ≈ -> regular expression
    let operators = ['!=', '>=', '<=', '=', '>', '<', '≈'];
    let params = url.split('?', 2)[1];
    let keyVal = {};
    let ors = [];
    if (!params) { return [keyVal, ors] };
    for (let part of params.split('&')) {
      part = decodeURI(part);
      let operator = '';
      for (let op of operators) {
        if (part.includes(op)) {
          operator = op;
          break;
        }
      }
      if (!operator) { continue; }
      let [key, val] = part.split(operator);
      let or = key[0] === '|';
      or && (key = key.slice(1));
      ors[key] = or;
      val = isNaN(+val) ? val : +val;
      if (operator !== '=') { val = { [operator]: val } };
      keyVal[key] = val;
    }
    return [keyVal, ors];
  }

  whereFromParams(params, ors) {
    let where = [];
    let whereVals = [];
    for (let [key, val] of Object.entries(params)) {
      let isObj = val && typeof val === 'object';
      let operator = isObj ? Object.keys(val)[0] : '=';
      val = isObj ? Object.values(val)[0] : val;
      operator = operator == '≈' ? 'REGEXP' : operator;
      where.push((ors[key] ? ' OR  ' : ' AND ') + key + ' ' + operator + ' ?');
      whereVals.push(val);
    }
    where = where.join('');
    return [where.slice(5), whereVals];
  }

  encryptPassword(password) {
    return crypto
      .createHmac('sha256', passwordSalt) // choose algorithm and salt
      .update(password)  // send the string to encrypt
      .digest('hex'); // decide on output format (in our case hexadecimal)
  }

}