import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/layouts/RootLayout";
import { LoginPage } from "./components/pages/LoginPage";
import { ManagerDashboard } from "./components/pages/ManagerDashboard";
import { CreateDemand } from "./components/pages/CreateDemand";
import { ResponsibleDashboard } from "./components/pages/ResponsibleDashboard";
import { TaskDetails } from "./components/pages/TaskDetails";
import { History } from "./components/pages/History";
import { Responsibles } from "./components/pages/Responsibles";
import { Settings } from "./components/pages/Settings";
import { RegisterPage } from "./components/pages/RegisterPage";
import { Platforms } from "./components/pages/Platforms";
import { MyIndicators } from "./components/pages/MyIndicators";
import { IndicatorsPresentation } from "./components/pages/IndicatorsPresentation";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },

  {
  path: "/cadastro",
  Component: RegisterPage,
},

  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: ManagerDashboard },
      { path: "minhas-demandas", Component: ResponsibleDashboard },
      { path: "criar-demanda", Component: CreateDemand },
      { path: "tarefa/:id", Component: TaskDetails },
      { path: "historico", Component: History },
      { path: "responsaveis", Component: Responsibles },
      { path: "configuracoes", Component: Settings },
      { path: "indicadores", Component: Platforms },
      { path: "meus-indicadores", Component: MyIndicators },
      { path: "indicadores/apresentacao", Component: IndicatorsPresentation },
    ],
  },
]);
