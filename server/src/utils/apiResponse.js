function success(data) {
  return { success: true, data };
}

function error(code, message) {
  return { success: false, code, message };
}

module.exports = { success, error };
