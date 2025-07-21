import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import '../App.css';
import { Home, MicVocalIcon, SpeechIcon, Subtitles, SquareChartGanttIcon, ScrollText } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import Logo from '@/components/Logo';
import { ModeToggle } from '@/components/mode-toggle';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';


// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Live Voice Translation",
    url: "/live-translation",
    icon: SquareChartGanttIcon,
  },
  {
    title: "Speech to Text + Summarize",
    url: "/speech-to-text",
    icon: MicVocalIcon,
  },
  {
    title: "Text to Speech",
    url: "/text-to-speech",
    icon: SpeechIcon,
  },
  {
    title: "Audio Transcription",
    url: "/transcription",
    icon: ScrollText,
  },
  {
    title: "Generate Captions",
    url: "/captioning",
    icon: Subtitles,
  },
]

const queryClient = new QueryClient()

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
    
     <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className='flex justify-center mb-3 ml-3'>    
            <Logo  />          
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url} className="hover:[&_svg]:stroke-[#FF7F50] [&.active]:[&_svg]:stroke-[#FF7F50]">
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
    </Sidebar>
    <div className="relative flex-1">
      <Outlet />
      <TanStackRouterDevtools />
      <SidebarTrigger className='fixed top-[10px] left-[10px] z-50'/>
      <ModeToggle className='fixed top-[10px] right-[10px] z-50'/>
    </div>


      {/* <div className="p-2 flex gap-2">
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>{' '}
        <Link to="/about" className="[&.active]:font-bold">
          About
        </Link>
      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools /> */}
    </QueryClientProvider>
  ),
})