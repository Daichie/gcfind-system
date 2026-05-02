function initUserLogin() {
  const form = $('#userLoginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    const email = ($('#userEmail')?.value || '').trim().toLowerCase();
    const password = $('#userPassword')?.value || '';
    const err = $('#loginError');
    if (err) err.textContent = '';

    showLoading('Signing you in...');

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    hideLoading();

    if (error) {
      if (err) err.textContent = error.message;
      return;
    }

    const user = data.user;
    if (!user) return;

    const profile = await fetchProfileById(user.id);

    if (!profile) {
      if (err) err.textContent = 'Profile not found. Please contact the administrator.';
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

    if (role === 'system_admin') {
      window.location.href = 'system-admin.html';
    } else if (role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'index.html';
    }
  });
}

function initAdminLogin() {
  const form = $('#adminLoginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    const email = ($('#adminEmail')?.value || '').trim().toLowerCase();
    const password = $('#adminPassword')?.value || '';
    const err = $('#adminLoginError');
    if (err) err.textContent = '';

    showLoading('Opening admin dashboard...');

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    hideLoading();

    if (error) {
      if (err) err.textContent = error.message;
      return;
    }

    const user = data.user;
    if (!user) return;

    const profile = await fetchProfileById(user.id);

    if (!profile || !['admin', 'system_admin'].includes(profile.role)) {
      if (err) err.textContent = 'This account does not have admin access.';
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

    window.location.href = profile.role === 'system_admin' ? 'system-admin.html' : 'admin.html';
  });
}

function initRegisterForm() {
  const form = $('#registerForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    const name = ($('#regName')?.value || '').trim();
    const email = ($('#regEmail')?.value || '').trim().toLowerCase();
    const password = ($('#regPassword')?.value || '').trim();
    const confirmPassword = ($('#regConfirmPassword')?.value || '').trim();
    const role = ($('#regRole')?.value || 'student').trim();
    const department = ($('#regDepartment')?.value || 'General').trim();

    if (!name || !email || !password || !confirmPassword) {
      showError('Please complete all fields.', { position: 'center' });
      return;
    }

    if (password !== confirmPassword) {
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


function initResetPasswordForm() {
  const form = document.getElementById('resetPasswordForm');
  if (!form) return;

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

    showSuccess('Password updated successfully. Please login again.', { position: 'center', duration: 1800 });
    await sb.auth.signOut();
    clearSession();
    setTimeout(() => { window.location.href = 'login.html'; }, 1600);
  });
}

/* ===================== REPORTS / ITEMS ===================== */
