<aside className="w-64 bg-[#0B0B0B] border-r border-[#1F1F1F] flex flex-col">
  
  <div className="p-6 border-b border-[#1F1F1F]">
    <div className="flex items-center gap-3">
      <img
        src="/logo.png"
        alt="Task Hub"
        className="w-11 h-11 object-contain"
      />

      <div>
        <h1 className="text-xl font-semibold text-white">
          𝚃𝚊𝚜𝚔 𝙷𝚞𝚋
        </h1>

        <p className="text-sm text-[#A1A1A1] mt-1">
          Sistema Diário
        </p>
      </div>
    </div>
  </div>

  <nav className="flex-1 p-4">
    <ul className="space-y-1">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        return (
          <li key={item.path}>
            <Link
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-[#181818] text-white border border-[#2A2A2A]'
                  : 'text-[#A1A1A1] hover:bg-[#181818] hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />

              <span className="font-medium">
                {item.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>

  <div className="p-4 border-t border-[#1F1F1F]">
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#121212] border border-[#1F1F1F]">
      
      <div className="w-10 h-10 rounded-full bg-[#242424] flex items-center justify-center">
        <span className="text-white font-semibold">
          {user?.name?.charAt(0).toUpperCase() || '?'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">
          {user?.name || 'Usuário'}
        </p>

        <p className="text-sm text-[#A1A1A1] truncate">
          {user?.role === 'manager' ? 'Gestor' : 'Responsável'}
        </p>
      </div>
    </div>

    <button
      onClick={handleLogout}
      className="
        w-full
        mt-2
        flex
        items-center
        gap-3
        px-4
        py-3
        rounded-xl
        text-[#A1A1A1]
        hover:bg-[#181818]
        hover:text-red-400
        transition-all
        duration-300
      "
    >
      <LogOut className="w-5 h-5" />

      <span className="font-medium">
        Sair
      </span>
    </button>
  </div>
</aside>