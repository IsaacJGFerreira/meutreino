import { FormEvent, useMemo, useState } from 'react';

type Exercicio = {
  id: string;
  nome: string;
  series: string;
  descanso: string;
};

type Treino = {
  id: string;
  titulo: string;
  foco: string;
  duracao: string;
  exercicios: Exercicio[];
};

const TREINOS: Treino[] = [
  {
    id: 'treino-a',
    titulo: 'Treino A',
    foco: 'Pernas e glúteos',
    duracao: '45 min',
    exercicios: [
      { id: 'agachamento', nome: 'Agachamento livre', series: '4x10', descanso: '60s' },
      { id: 'leg-press', nome: 'Leg press', series: '4x12', descanso: '60s' },
      { id: 'afundo', nome: 'Afundo com halteres', series: '3x12', descanso: '45s' },
    ],
  },
  {
    id: 'treino-b',
    titulo: 'Treino B',
    foco: 'Costas e bíceps',
    duracao: '50 min',
    exercicios: [
      { id: 'remada', nome: 'Remada curvada', series: '4x10', descanso: '60s' },
      { id: 'puxada', nome: 'Puxada frente', series: '4x12', descanso: '60s' },
      { id: 'rosca', nome: 'Rosca direta', series: '3x12', descanso: '45s' },
    ],
  },
  {
    id: 'treino-c',
    titulo: 'Treino C',
    foco: 'Peito, ombro e tríceps',
    duracao: '55 min',
    exercicios: [
      { id: 'supino', nome: 'Supino reto', series: '4x8', descanso: '90s' },
      { id: 'desenvolvimento', nome: 'Desenvolvimento', series: '4x10', descanso: '60s' },
      { id: 'triceps', nome: 'Tríceps corda', series: '3x12', descanso: '45s' },
    ],
  },
];

export function AlunoPage() {
  const [treinoAtivoId, setTreinoAtivoId] = useState<string | null>(null);
  const [treinoExpandidoId, setTreinoExpandidoId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState('Expanda o treino para ver exercícios e clique em iniciar para registrar.');

  const treinoAtivo = useMemo(
    () => TREINOS.find((treino) => treino.id === treinoAtivoId) ?? null,
    [treinoAtivoId],
  );

  function iniciarTreino(treinoId: string) {
    if (treinoAtivoId && treinoAtivoId !== treinoId) {
      return;
    }

    setTreinoAtivoId(treinoId);
    setTreinoExpandidoId(treinoId);
    setMensagem('Treino iniciado! Agora os campos de registro foram liberados para este treino.');
  }

  function toggleDetalhesTreino(treinoId: string) {
    setTreinoExpandidoId((atual) => (atual === treinoId ? null : treinoId));
  }

  function atualizarRegistro(chave: string, valor: string) {
    setRegistros((atual) => ({
      ...atual,
      [chave]: valor,
    }));
  }

  function salvarTreino(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!treinoAtivo) {
      return;
    }

    setTreinoAtivoId(null);
    setTreinoExpandidoId(null);
    setMensagem(`Treino ${treinoAtivo.titulo} finalizado e salvo com sucesso! Agora você pode iniciar outro treino.`);
  }

  return (
    <div className="aluno-page">
      <header className="aluno-header">
        <h2>Aba de treino</h2>
        <p>{mensagem}</p>
      </header>

      <div className="treinos-grid">
        {TREINOS.map((treino) => {
          const treinoAtivo = treino.id === treinoAtivoId;
          const treinoExpandido = treino.id === treinoExpandidoId;
          const bloqueadoPorOutroTreino = treinoAtivoId !== null && !treinoAtivo;

          return (
            <article key={treino.id} className={`treino-card ${treinoAtivo ? 'ativo' : ''}`}>
              <div className="treino-card-topo">
                <div>
                  <h3>{treino.titulo}</h3>
                  <p>
                    {treino.foco} • {treino.duracao}
                  </p>
                </div>
                <button
                  type="button"
                  className="botao-iniciar"
                  disabled={bloqueadoPorOutroTreino}
                  onClick={() => iniciarTreino(treino.id)}
                >
                  {treinoAtivo ? 'Treino em andamento' : 'Iniciar treino'}
                </button>
              </div>

              <button
                type="button"
                className="botao-expansao"
                onClick={() => toggleDetalhesTreino(treino.id)}
              >
                {treinoExpandido ? 'Ocultar exercícios' : 'Ver exercícios'}
              </button>

              {treinoExpandido && (
                <div className="lista-exercicios">
                  {bloqueadoPorOutroTreino && (
                    <small>Finalize o treino atual para iniciar este plano e liberar os registros.</small>
                  )}

                  {!treinoAtivo && !bloqueadoPorOutroTreino && (
                    <button type="button" className="botao-iniciar botao-iniciar-registro" onClick={() => iniciarTreino(treino.id)}>
                      Iniciar treino para registrar
                    </button>
                  )}

                  <form onSubmit={salvarTreino}>
                    {treino.exercicios.map((exercicio) => {
                      const campo = `${treino.id}-${exercicio.id}`;

                      return (
                        <div key={exercicio.id} className="exercicio-item">
                          <div>
                            <strong>{exercicio.nome}</strong>
                            <p>
                              {exercicio.series} • descanso {exercicio.descanso}
                            </p>
                          </div>
                          <label>
                            Registro
                            <input
                              value={registros[campo] ?? ''}
                              onChange={(event) => atualizarRegistro(campo, event.target.value)}
                              placeholder="Ex: 20kg | 10 rep"
                              disabled={!treinoAtivo}
                            />
                          </label>
                        </div>
                      );
                    })}

                    <button type="submit" className="botao-salvar" disabled={!treinoAtivo}>
                      Salvar treino
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
