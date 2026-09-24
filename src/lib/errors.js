export function authErrorMessage(error) {
  const msg = String(error?.message || '').toLowerCase()

  if (msg.includes('password') && (msg.includes('6') || msg.includes('least') || msg.includes('short') || msg.includes('weak'))) {
    return 'La contraseña es demasiado corta. Usa al menos 6 caracteres.'
  }
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already')) {
    return 'Ese correo ya está registrado. Inicia sesión o usa otro email.'
  }
  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('invalid email or password')) {
    return 'Correo o contraseña incorrectos.'
  }
  if (msg.includes('email not confirmed')) {
    return 'Debes confirmar el correo antes de entrar. Revisa tu bandeja de entrada.'
  }
  if (msg.includes('unable to validate email') || (msg.includes('email') && msg.includes('invalid'))) {
    return 'Revisa el correo electrónico. Debe tener un formato válido.'
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
    return 'Sin conexión. Revisa internet e inténtalo de nuevo.'
  }

  return error?.message || 'No se pudo completar la operación. Inténtalo de nuevo.'
}

export function dataErrorMessage(error) {
  const msg = String(error?.message || '').toLowerCase()
  if (msg.includes('failed to fetch') || msg.includes('network') || error?.name === 'AuthRetryableFetchError') {
    return 'Sin conexión. La captura se guardó en el teléfono y se reintentará.'
  }
  return error?.message || 'No se pudo sincronizar con el servidor.'
}
