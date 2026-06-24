const enhancedButtons = new WeakSet<HTMLButtonElement>();

function enhanceWorkoutBuilderDeleteButtons() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('button[aria-label="Remover"]');

  buttons.forEach((button) => {
    if (enhancedButtons.has(button)) return;

    const row = button.closest('.list-row');
    const isExerciseRow = Boolean(row?.closest('.exercise-stack.compact'));
    if (!isExerciseRow) return;

    enhancedButtons.add(button);
    button.setAttribute('aria-label', 'Excluir exercício');
    button.setAttribute('title', 'Excluir exercício');

    button.addEventListener(
      'click',
      (event) => {
        const exerciseName = row?.querySelector('strong')?.textContent?.trim() || 'este exercício';
        const confirmed = window.confirm(
          `Excluir "${exerciseName}" deste treino?\n\nDepois clique em Salvar treino para gravar a alteração no Firebase.`
        );

        if (!confirmed) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', enhanceWorkoutBuilderDeleteButtons);
  const observer = new MutationObserver(enhanceWorkoutBuilderDeleteButtons);
  observer.observe(document.body, { childList: true, subtree: true });
}
