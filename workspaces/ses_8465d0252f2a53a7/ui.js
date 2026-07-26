// ui.js - Task Manager UI Logic
document.getElementById('taskInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const input = e.target;
    const text = input.value.trim();
    if (text) {
      const li = document.createElement('li');
      li.textContent = text;
      li.addEventListener('click', function() {
        this.classList.toggle('done');
      });
      document.getElementById('taskList').appendChild(li);
      input.value = '';
    }
  }
});
