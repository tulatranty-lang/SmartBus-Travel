import {Component,lazy,Suspense,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,Route,Routes,useNavigate} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MotionConfig} from 'motion/react';
import {Toaster} from 'sonner';
import {Compass,RefreshCw} from 'lucide-react';
import {AppState} from './state';
import {ApiError} from './api';
import Layout from './components/Layout';
import {Busy,Button,Empty} from './components/ui';
import {Home,RoutesPage,PlacesPage,ExplorePage} from './pages/ExplorePages';
import './style.css';
const Planner=lazy(()=>import('./pages/Planner'));
const Admin=lazy(()=>import('./pages/Admin'));
const Favorites=lazy(()=>import('./pages/PersonalPages').then(m=>({default:m.Favorites})));
const Community=lazy(()=>import('./pages/PersonalPages').then(m=>({default:m.Community})));
const History=lazy(()=>import('./pages/PersonalPages').then(m=>({default:m.HistoryPage})));
const client=new QueryClient({defaultOptions:{queries:{staleTime:45000,gcTime:300000,refetchOnWindowFocus:false,retry:(count,e)=>e.name!=='AbortError'&&!(e instanceof ApiError&&[400,401,403,404,422,429].includes(e.status))&&count<1},mutations:{retry:false}}});
class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){if(this.state.failed)return <main className="fatal-error"><Empty title="Hành trình tạm dừng một chút" description="Một lỗi hiển thị vừa xảy ra. Hãy tải lại trang để tiếp tục." action={<Button onClick={()=>window.location.reload()}><RefreshCw size={16}/>Tải lại trang</Button>}/></main>;return this.props.children}}
function Missing(){const nav=useNavigate();return <Empty icon={Compass} title="Chuyến đi này chưa có trên bản đồ" description="Đường dẫn có thể đã thay đổi. Trở về trang khám phá để tìm hành trình mới." action={<Button onClick={()=>nav('/')}>Về tổng quan</Button>}/>}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><QueryClientProvider client={client}><MotionConfig reducedMotion="user"><HashRouter><AppState><Suspense fallback={<Busy text="Đang chuẩn bị hành trình…"/>}><Routes><Route element={<Layout/>}><Route index element={<Home/>}/><Route path="explore" element={<ExplorePage/>}/><Route path="routes" element={<RoutesPage/>}/><Route path="places" element={<PlacesPage/>}/><Route path="planner" element={<Planner/>}/><Route path="favorites" element={<Favorites/>}/><Route path="community" element={<Community/>}/><Route path="history" element={<History/>}/><Route path="admin" element={<Admin/>}/><Route path="*" element={<Missing/>}/></Route></Routes></Suspense><Toaster position="bottom-right" richColors closeButton toastOptions={{className:'smartbus-toast'}}/></AppState></HashRouter></MotionConfig></QueryClientProvider></ErrorBoundary>);
