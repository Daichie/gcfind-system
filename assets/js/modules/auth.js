
function gcfindClearFieldErrors(form) {
  if (!form) return;
  form.querySelectorAll('.gc-field-error').forEach(el => el.remove());
  form.querySelectorAll('.gc-field-invalid').forEach(el => el.classList.remove('gc-field-invalid'));
}

function gcfindMarkRequiredField(input, message = 'This field is required.') {
  if (!input) return;
  input.classList.add('gc-field-invalid');
  const wrapper = input.parentElement || input;
  if (!wrapper.parentElement) return;
  if (wrapper.parentElement.querySelector(`[data-error-for="${input.id}"]`)) return;
  const p = document.createElement('p');
  p.className = 'gc-field-error';
  p.dataset.errorFor = input.id;
  p.textContent = message;
  wrapper.parentElement.appendChild(p);
}

function gcfindValidateRequiredFields(fields) {
  let valid = true;
  fields.forEach(({ input, message }) => {
    if (!input) return;
    if (!String(input.value || '').trim()) {
      valid = false;
      gcfindMarkRequiredField(input, message);
    }
  });
  return valid;
}

function gcfindAttachFieldErrorCleanup(scope = document) {
  scope.querySelectorAll('input, textarea, select').forEach(input => {
    if (input.dataset.gcFieldCleanupReady === 'true') return;
    input.dataset.gcFieldCleanupReady = 'true';
    input.addEventListener('input', () => {
      if (String(input.value || '').trim()) {
        input.classList.remove('gc-field-invalid');
        input.parentElement?.parentElement?.querySelector(`[data-error-for="${input.id}"]`)?.remove();
      }
    });
    input.addEventListener('change', () => {
      if (String(input.value || '').trim()) {
        input.classList.remove('gc-field-invalid');
        input.parentElement?.parentElement?.querySelector(`[data-error-for="${input.id}"]`)?.remove();
      }
    });
  });
}


function initUserLogin() {
  const form = $('#userLoginForm');
  if (!form) return;

  gcfindAttachFieldErrorCleanup(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    gcfindClearFieldErrors(form);

    const emailInput = $('#userEmail');
    const passwordInput = $('#userPassword');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = passwordInput?.value || '';
    const err = $('#loginError');
    if (err) err.textContent = '';

    const requiredOk = gcfindValidateRequiredFields([
      { input: emailInput, message: 'Email is required.' },
      { input: passwordInput, message: 'Password is required.' }
    ]);

    if (!requiredOk) {
      if (err) err.textContent = 'Please fill out the required fields.';
      showError('Please fill out the required fields.', { position: 'center' });
      return;
    }

    showLoading('Signing you in...');

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        if (err) err.textContent = error.message;
        showError(error.message || 'Something went wrong. Please try again.', { position: 'center', duration: 3200 });
        return;
      }

      const user = data?.user;
      if (!user) {
        showError('Unable to sign in. Please try again.', { position: 'center', duration: 3200 });
        return;
      }

      const profile = await Promise.race([
        fetchProfileById(user.id),
        new Promise(resolve => setTimeout(() => resolve(null), 6000))
      ]);

      if (!profile) {
        if (err) err.textContent = 'Profile not found. Please contact the administrator.';
        showError('Profile not found. Please contact the administrator.', { position: 'center', duration: 3200 });
        await sb.auth.signOut();
        clearSession();
        return;
      }

      const role = profile.role || 'student';

      setRole(role === 'admin' || role === 'system_admin' ? 'admin' : 'user');
      setUser({
        id: user.id,
        name: profile.full_name || user.email,
        email: user.email,
        role,
        department: profile.department || 'General'
      });

      showSuccess('Login successful. Redirecting...', { position: 'center', duration: 900 });
      setTimeout(() => {
        if (role === 'system_admin') {
          window.location.href = 'system-admin.html';
        } else if (role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      }, 850);
    } catch (error) {
      console.error('Login failed:', error);
      showError(error.message || 'Login failed. Please try again.', { position: 'center', duration: 3200 });
    } finally {
      hideLoading();
    }
  });
}


function initAdminLogin() {
  const form = $('#adminLoginForm');
  if (!form) return;

  gcfindAttachFieldErrorCleanup(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    gcfindClearFieldErrors(form);

    const emailInput = $('#adminEmail');
    const passwordInput = $('#adminPassword');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = passwordInput?.value || '';
    const err = $('#adminLoginError');
    if (err) err.textContent = '';

    const requiredOk = gcfindValidateRequiredFields([
      { input: emailInput, message: 'Email is required.' },
      { input: passwordInput, message: 'Password is required.' }
    ]);

    if (!requiredOk) {
      if (err) err.textContent = 'Please fill out the required fields.';
      showError('Please fill out the required fields.', { position: 'center' });
      return;
    }

    showLoading('Opening admin dashboard...');

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        if (err) err.textContent = error.message;
        showError(error.message || 'Unable to sign in.', { position: 'center', duration: 3200 });
        return;
      }

      const user = data?.user;
      if (!user) {
        showError('Unable to sign in. Please try again.', { position: 'center', duration: 3200 });
        return;
      }

      const profile = await Promise.race([
        fetchProfileById(user.id),
        new Promise(resolve => setTimeout(() => resolve(null), 6000))
      ]);

      if (!profile || !['admin', 'system_admin'].includes(profile.role)) {
        if (err) err.textContent = 'This account does not have admin access.';
        showError('This account does not have admin access.', { position: 'center', duration: 3200 });
        await sb.auth.signOut();
        clearSession();
        return;
      }

      setRole('admin');
      setUser({
        id: user.id,
        name: profile.full_name || user.email,
        email: user.email,
        role: profile.role,
        department: profile.department || 'Security Office'
      });

      showSuccess('Login successful. Redirecting...', { position: 'center', duration: 900 });
      setTimeout(() => {
        window.location.href = profile.role === 'system_admin' ? 'system-admin.html' : 'admin.html';
      }, 850);
    } catch (error) {
      console.error('Admin login failed:', error);
      showError(error.message || 'Admin login failed. Please try again.', { position: 'center', duration: 3200 });
    } finally {
      hideLoading();
    }
  });
}


function initRegisterForm() {
  const form = $('#registerForm');
  if (!form) return;

  gcfindAttachFieldErrorCleanup(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    gcfindClearFieldErrors(form);

    const nameInput = $('#regName');
    const emailInput = $('#regEmail');
    const passwordInput = $('#regPassword');
    const confirmPasswordInput = $('#regConfirmPassword');

    const name = (nameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim().toLowerCase();
    const password = (passwordInput?.value || '').trim();
    const confirmPassword = (confirmPasswordInput?.value || '').trim();
    const role = ($('#regRole')?.value || 'student').trim();
    const department = ($('#regDepartment')?.value || 'General').trim();

    const requiredOk = gcfindValidateRequiredFields([
      { input: nameInput, message: 'Full name is required.' },
      { input: emailInput, message: 'Email is required.' },
      { input: passwordInput, message: 'Password is required.' },
      { input: confirmPasswordInput, message: 'Please confirm your password.' }
    ]);

    if (!requiredOk) {
      showError('Please complete all required fields.', { position: 'center' });
      return;
    }

    if (password !== confirmPassword) {
      gcfindMarkRequiredField(confirmPasswordInput, 'Passwords do not match.');
      showError('Passwords do not match.', { position: 'center' });
      return;
    }

    showLoading('Creating your account...');

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role,
          department
        }
      }
    });

    if (error) {
      hideLoading();
      showError(error.message, { position: 'center', duration: 3200 });
      return;
    }

    const authUser = data.user;
    if (!authUser) {
      hideLoading();
      showError('Unable to create account.', { position: 'center' });
      return;
    }

    // Wait briefly to allow the DB trigger to create the profile row.
    let profile = null;
    for (let i = 0; i < 5; i++) {
      profile = await fetchProfileById(authUser.id);
      if (profile) break;
      await new Promise(r => setTimeout(r, 300));
    }

    hideLoading();

    if (!profile) {
      showInfo('Account created. If login says profile not found, run the latest schema/trigger SQL once in Supabase.', { position: 'center', duration: 4200 });
    } else {
      showSuccess('Account created successfully. Redirecting to login...', { position: 'center', duration: 1400 });
    }

    await sb.auth.signOut();
    clearSession();
    setTimeout(() => {
      window.location.href = 'login.html';
    }, profile ? 1300 : 2400);
  });
}


function initPasswordToggles(scope = document) {
  scope.querySelectorAll('[data-toggle-password]').forEach(btn => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePassword);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) icon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  });
}

async function initResetPasswordForm() {
  const form = document.getElementById('resetPasswordForm');
  if (!form) return;
  if (!requireSupabase()) return;

  initPasswordToggles(document);

  const statusBox = document.getElementById('resetLinkStatus');
  const setStatus = (message, kind = 'info') => {
    if (!statusBox) return;
    const styles = {
      info: 'mt-5 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-100',
      warn: 'mt-5 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100',
      error: 'mt-5 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100',
      success: 'mt-5 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-100'
    };
    statusBox.className = styles[kind] || styles.info;
    statusBox.textContent = message;
  };

  function getUrlAuthParams() {
    const searchParams = new URLSearchParams(window.location.search || '');
    const hashString = String(window.location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hashString);
    return {
      code: searchParams.get('code'),
      accessToken: hashParams.get('access_token'),
      refreshToken: hashParams.get('refresh_token'),
      type: searchParams.get('type') || hashParams.get('type')
    };
  }

  function cleanRecoveryUrl() {
    // Prevent accidental re-use of recovery tokens when the page refreshes.
    if (window.history?.replaceState) {
      window.history.replaceState({}, document.title, `${window.location.pathname}`);
    }
  }

  async function waitForSession(maxTries = 14, delayMs = 300) {
    for (let i = 0; i < maxTries; i++) {
      const { data } = await sb.auth.getSession();
      if (data?.session) return data.session;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return null;
  }

  async function getRecoverySession() {
    const { code, accessToken, refreshToken } = getUrlAuthParams();

    // Supabase PKCE reset links arrive as /reset-password.html?code=...
    if (code && sb.auth.exchangeCodeForSession) {
      try {
        const { data, error } = await sb.auth.exchangeCodeForSession(code);
        if (!error && data?.session) {
          cleanRecoveryUrl();
          return data.session;
        }
      } catch (err) {
        console.error('exchangeCodeForSession failed:', err);
      }
    }

    // Supabase implicit reset links arrive as #access_token=...&refresh_token=...
    // Setting the session manually avoids the false “expired link” state.
    if (accessToken && refreshToken && sb.auth.setSession) {
      try {
        const { data, error } = await sb.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (!error && data?.session) {
          cleanRecoveryUrl();
          return data.session;
        }
      } catch (err) {
        console.error('setSession from recovery hash failed:', err);
      }
    }

    // Fallback: Supabase may restore the session asynchronously after page load.
    return await waitForSession();
  }

  setStatus('Checking reset link...');
  const authParams = getUrlAuthParams();
  const hasRecoveryToken = Boolean(
    authParams.code ||
    authParams.accessToken ||
    authParams.refreshToken
  );

  const session = await getRecoverySession();

  if (!session) {
    setStatus(
      hasRecoveryToken
        ? 'This reset link could not be verified. It may be expired or already used. Please request a new password reset email.'
        : 'This reset link is missing recovery credentials. Please request a new password reset email.',
      'error'
    );
    form.classList.add('hidden');
    return;
  }

  setStatus('Reset link verified. Enter your new password below.', 'success');
  form.classList.remove('hidden');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    const password = (document.getElementById('newPassword')?.value || '').trim();
    const confirmPassword = (document.getElementById('confirmNewPassword')?.value || '').trim();
    const err = document.getElementById('resetPasswordError');
    if (err) err.textContent = '';

    if (!password || !confirmPassword) {
      if (err) err.textContent = 'Please enter and confirm your new password.';
      return;
    }

    if (password.length < 6) {
      if (err) err.textContent = 'Password must be at least 6 characters.';
      return;
    }

    if (password !== confirmPassword) {
      if (err) err.textContent = 'Passwords do not match.';
      return;
    }

    showLoading('Updating password...');
    const { error } = await sb.auth.updateUser({ password });
    hideLoading();

    if (error) {
      if (err) err.textContent = error.message;
      return;
    }

    setStatus('Password updated successfully. Redirecting to login...', 'success');
    showSuccess('Password updated successfully. Please login again.', { position: 'center', duration: 1800 });
    await sb.auth.signOut();
    clearSession();
    setTimeout(() => { window.location.href = 'login.html'; }, 1600);
  });
}

/* ===================== REPORTS / ITEMS ===================== */



function initForgotPassword() {
  const openBtn = document.getElementById('forgotPasswordLink');
  const modal = document.getElementById('forgotPasswordModal');
  const closeBtn = document.getElementById('forgotPasswordClose');
  const cancelBtn = document.getElementById('forgotPasswordCancel');
  const form = document.getElementById('forgotPasswordForm');
  const emailInput = document.getElementById('forgotPasswordEmail');
  const message = document.getElementById('forgotPasswordMessage');
  if (!openBtn || !modal || !form) return;

  const openModal = () => {
    const loginEmail = document.getElementById('userEmail')?.value || '';
    if (emailInput && !emailInput.value) emailInput.value = loginEmail;
    if (message) {
      message.textContent = '';
      message.className = 'text-sm font-medium';
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => emailInput?.focus(), 50);
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  openBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireSupabase()) return;

    const email = (emailInput?.value || '').trim().toLowerCase();
    if (!email) return;

    const redirectTo = `${window.location.origin}/pages/reset-password.html`;

    try {
      showLoading('Sending password reset link...');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) throw error;

      if (message) {
        message.textContent = 'Password reset link sent. Please check your email. Redirecting to login...';
        message.className = 'text-sm font-semibold text-emerald-700';
      }

      showLoading('Reset link sent. Returning to login...');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1200);
    } catch (err) {
      hideLoading();
      if (message) {
        message.textContent = err.message || 'Unable to send reset link.';
        message.className = 'text-sm font-semibold text-red-600';
      }
      showError(err.message || 'Unable to send reset link.', { position: 'center' });
    }
  });
}

