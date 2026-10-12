import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Methodology from "@/pages/methodology";
import ClimateValuation from "@/pages/climate-valuation";
import DecarbSignal from "@/pages/decarb-signal";
import DecarbGapSignal from "@/pages/decarb-gap-signal";
import NewsSentiment from "@/pages/news-sentiment";
import DataManagement from "@/pages/data-management";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/methodology" component={Methodology} />
      <Route path="/climate-valuation" component={ClimateValuation} />
      <Route path="/decarb-signal" component={DecarbSignal} />
      <Route path="/decarb-gap" component={DecarbGapSignal} />
      <Route path="/news-sentiment" component={NewsSentiment} />
      <Route path="/data-management" component={DataManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
