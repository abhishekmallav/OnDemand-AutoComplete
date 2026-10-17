// Illustrative demo only: the extension is not required to use this page.
const expandButton = document.querySelector('#demo-expand');
const result = document.querySelector('#demo-result');
let expanded = false;
expandButton.addEventListener('click', () => {
  expanded = !expanded;
  result.replaceChildren();
  if (expanded) {
    result.append('Best regards,', document.createElement('br'), 'Abhishek Mallav');
  } else {
    const trigger = document.createElement('code');
    trigger.textContent = '/sig';
    result.append(trigger);
  }
  expandButton.textContent = expanded ? 'Try it again ↺' : 'Expand the shortcut ↵';
});

const galleryNav = document.querySelector('.gallery-nav');
const figures = document.querySelectorAll('.gallery figure');
galleryNav.hidden = false;
figures.forEach((figure, index) => { figure.hidden = index !== 0; });
galleryNav.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-shot]');
  if (!button) return;
  galleryNav.querySelectorAll('button').forEach((item) => {
    const selected = item === button;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  figures.forEach((figure) => { figure.hidden = figure.id !== `shot-${button.dataset.shot}`; });
});
