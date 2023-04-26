import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useStates } from './utilities/states.js';
import { useEffect } from 'react';
import { get, post, del } from './utilities/backend-talk';

export default function App() {
  /// hello everybody :) 
  let my = "name";
  // Crammed a lot of things together in one component
  // since focus is demo of backend REST api

  const s = useStates('main', {
    user: null
  });

  const l = useStates({
    tablesAndViews: [],
    dataToShow: undefined,
    loginForm: {
      email: '',
      password: ''
    }
  });

  useEffect(() => {
    (async () => {
      let loggedIn = await get('/api/login');
      if (loggedIn.email) { s.user = loggedIn; }
      l.tablesAndViews = await get('/api/tables_and_views?sort=-type,name');
    })();
  }, []);

  let ul = useLocation();
  let path = ul.pathname + ul.search;
  let navigate = useNavigate();

  useEffect(() => {
    let show = path.split('/showJson/')[1];
    if (!show) { l.dataToShow = undefined; return; }
    (async () => {
      l.dataToShow = await get('/api/' + show);
    })();
  }, [path]);

  async function login(e) {
    e.preventDefault();
    let result = await post('/api/login', l.loginForm);
    l.loginForm.email = '';
    l.loginForm.password = '';
    if (!result.error) {
      console.log(result)
      s.user = result;
    }
  }

  async function logout() {
    let result = await del('/api/login');
    if (!result.error) { s.user = null; }
  }

  function showJson(name) {
    navigate('/showJson/' + name);
  }

  return <>
    <header>
      {!s.user && <form onSubmit={login}>
        <input type="email" placeholder="email"
          {...l.loginForm.bind('email')} />
        <input type="password" placeholder="password"
          {...l.loginForm.bind('password')} />
        <button type="submit">Login</button>
      </form>}
      {s.user && <div className="loginInfo">
        <span>Logged in as {s.user.email}</span>
        <button onClick={logout}>Logout</button>
      </div>}
    </header>
    <main>
      {
        path === '/' && <>
          <table>
            <thead><tr><th>Type</th><th>Name</th></tr></thead>
            <tbody>
              {l.tablesAndViews.map(({ type, name }) => <tr onClick={() => showJson(name)}>
                <td>{type}</td>
                <td>{name}</td>
              </tr>)}
            </tbody>
          </table>
          <h1>Hello world!</h1>
          <p>Now we have a backend with a REST-api:</p>
          <p>So, if you have run <b>npm run seed-db</b> once to seed your database and started up the app with <b>npm start</b>, you should see a list of views and tables to the right.</p>
          <p>Click on a view or a table and we'll fetch the data from the database via the REST-api.</p>
          <p>The database is based on <Link to="/er-diagram">this ER-diagram</Link>.</p>
          <hr />
          <p>We also have login/logout working. You can try to login with<br /><br /> <div onClick={() => { l.loginForm.email = 'feyerse@apple.com'; l.loginForm.password = 'Xrnqf3I' }} style={{ cursor: 'pointer' }}>email: <b>feyerse@apple.com</b><br />password: <b>Xrnqf3I</b></div></p>
          <p>(or any of the other 99 users that you'll find in the file<i>_seed_db/json/users.json</i>.)</p>
          <p>Register then? Not in this demo, but just post to the <b>users</b> table.</p>
          <hr />
          <p>There are some new helper functions for get,post,put and delete fetches in <i>src/utilities/backend-talk.js</i>.</p>
          <p>And the REST-api have som really cool search functionality, read about it on the blog!</p>
        </>
      }
      {
        path === '/er-diagram' && <>
          <img className="er" src="/er-diagram/cinema-er-diagram.svg" />
        </>
      }
      {l.dataToShow && <>
        <h2>/api/{path.split('showJson/')[1]}</h2>
        {/** This is not how you would use the data in 'real app life' 
       *   - but now we just want to show tje JSON - with some syntax highlighting,
       *     thus the dangerouslySetInnerHTML and reg exp replacements... **/}
        <pre dangerouslySetInnerHTML=
          {{
            __html: JSON.stringify(l.dataToShow, null, '  ')
              .replace(/("posterImage": )"([^"]*)"/g,
                '$1"$2"<img class="poster" src="$2">')
              .replace(/("[^"]*":)/g,
                `<span class="key ${path.split('showJson/').pop()}">$1</span>`)
          }} />
      </>}
    </main>
  </ >;
}