(function () {
  // Захардкоженные логин и пароль для доступа
  // При необходимости просто поменяй значения ниже
  // Логин/пароль видны в коде, это осознанно.
  const USERNAME = 'temp-dashboard';
  const PASSWORD = 'TempDash_24!';

  const STORAGE_KEY = 'ab_in4868_auth';

  function unlock() {
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
    try {
      localStorage.setItem(STORAGE_KEY, 'ok');
    } catch (e) {
      // Если localStorage недоступен — просто игнорируем
    }
  }

  function checkAuth() {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'ok') {
        unlock();
      }
    } catch (e) {
      // localStorage может быть выключен, тогда всегда просим логин/пароль
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const loginInput = document.getElementById('login-input');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');
    const errorBox = document.getElementById('login-error');

    if (!loginInput || !passwordInput || !loginButton) {
      return;
    }

    checkAuth();

    function tryLogin() {
      const login = loginInput.value.trim();
      const pass = passwordInput.value;

      if (login === USERNAME && pass === PASSWORD) {
        if (errorBox) errorBox.style.display = 'none';
        unlock();
      } else {
        if (errorBox) errorBox.style.display = 'block';
      }
    }

    loginButton.addEventListener('click', function () {
      tryLogin();
    });

    [loginInput, passwordInput].forEach(function (el) {
      el.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
          tryLogin();
        }
      });
    });
  });
})();

