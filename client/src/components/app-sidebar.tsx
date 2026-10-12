import { BarChart3, BookOpen, DollarSign, Activity, Newspaper, ArrowLeftRight, Database } from "lucide-react";
import { useLocation, Link } from "wouter";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: BarChart3,
  },
  {
    title: "Methodology",
    url: "/methodology",
    icon: BookOpen,
  },
  {
    title: "Scenario Analyzer",
    url: "/climate-valuation",
    icon: DollarSign,
  },
  {
    title: "Decarb Signal",
    url: "/decarb-signal",
    icon: Activity,
  },
  {
    title: "Decarb Gap",
    url: "/decarb-gap",
    icon: ArrowLeftRight,
  },
  {
    title: "News Sentiment",
    url: "/news-sentiment",
    icon: Newspaper,
  },
  {
    title: "Data Management",
    url: "/data-management",
    icon: Database,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold" data-testid="text-sidebar-title">Climate Dashboard</p>
            <p className="text-[10px] text-muted-foreground" data-testid="text-sidebar-subtitle">Decarbonization Tracker</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-sidebar-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Data: IEA, IRENA, SBTi, Gallup, Pew Research, Climate Action Tracker
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
