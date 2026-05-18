<div className="space-y-6 min-h-screen bg-[#0B0B0B] text-white p-6">

  <div>
    <h1 className="text-3xl font-semibold text-white">
      Olá, {user?.name}
    </h1>

    <p className="text-[#A1A1A1] mt-1">
      Você tem {tasks.length} tarefa(s) para hoje
    </p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

    <Card className="
      p-5
      bg-[#121212]
      border
      border-[#1F1F1F]
      shadow-lg
      shadow-black/20
    ">
      <p className="text-sm text-[#A1A1A1]">
        Pendentes
      </p>

      <p className="text-3xl font-semibold text-white mt-2">
        {tasks.filter((t) => t.status === 'pending').length}
      </p>
    </Card>

    <Card className="
      p-5
      bg-[#121212]
      border
      border-[#1F1F1F]
      shadow-lg
      shadow-black/20
    ">
      <p className="text-sm text-[#A1A1A1]">
        Concluídas
      </p>

      <p className="text-3xl font-semibold text-white mt-2">
        {tasks.filter((t) => t.status === 'completed').length}
      </p>
    </Card>

    <Card className="
      p-5
      bg-[#121212]
      border
      border-[#1F1F1F]
      shadow-lg
      shadow-black/20
    ">
      <p className="text-sm text-[#A1A1A1]">
        Atrasadas
      </p>

      <p className="text-3xl font-semibold text-white mt-2">
        {tasks.filter((t) => t.status === 'overdue').length}
      </p>
    </Card>

  </div>

  <div>
    <h2 className="text-xl font-semibold mb-4 text-white">
      Minhas Tarefas
    </h2>

    {tasks.length === 0 ? (

      <Card className="
        p-12
        text-center
        bg-[#121212]
        border
        border-[#1F1F1F]
      ">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[#22C55E]" />

        <p className="text-[#A1A1A1]">
          Nenhuma tarefa para hoje
        </p>
      </Card>

    ) : (

      tasks.map((task) => (

        <Card
          key={task.id}
          className="
            p-5
            bg-[#121212]
            border
            border-[#1F1F1F]
            hover:border-[#2A2A2A]
            transition-all
            duration-300
            shadow-lg
            shadow-black/20
          "
        >

          <div className="flex justify-between mb-3">
            <div>

              <div className="flex items-center gap-2">

                {getStatusIcon(task.status)}

                <h3 className="font-semibold text-white">
                  {task.title}
                </h3>

                <span className={`
                  px-2
                  py-1
                  text-xs
                  rounded-lg
                  border

                  ${task.status === 'completed'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : task.status === 'overdue'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                  }
                `}>
                  {getStatusText(task.status)}
                </span>

              </div>

              <p className="text-sm text-[#A1A1A1] mt-2">
                {task.description}
              </p>

              <p className="text-sm text-[#707070] mt-2">
                Prazo:{' '}
                {new Date(task.deadline).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>

            </div>
          </div>

          <div className="flex gap-2 mt-3">

            {task.status !== 'completed' && (
              <>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/tarefa/${task.id}`)}
                  className="
                    bg-[#181818]
                    border-[#2A2A2A]
                    text-white
                    hover:bg-[#242424]
                    hover:border-[#3A3A3A]
                  "
                >
                  <Image className="w-4 h-4 mr-2" />
                  Enviar Foto
                </Button>

                <Button
                  size="sm"
                  onClick={() => navigate(`/tarefa/${task.id}`)}
                  className="
                    bg-white
                    text-black
                    hover:bg-[#E5E5E5]
                  "
                >
                  Concluir
                </Button>

              </>
            )}

            {task.status === 'completed' && (
              <span className="text-green-400 text-sm">
                ✔ Concluída às{' '}
                {task.completed_at &&
                  new Date(task.completed_at).toLocaleTimeString('pt-BR')}
              </span>
            )}

          </div>

        </Card>

      ))

    )}
  </div>
</div>