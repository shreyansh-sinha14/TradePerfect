import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import 'antd/dist/reset.css';
import './index.css';
const queryClient = new QueryClient({ defaultOptions:{queries:{staleTime:5000,retry:1,refetchOnWindowFocus:false}} });
createRoot(document.getElementById('root')).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><ConfigProvider theme={{token:{colorPrimary:'#176b87',borderRadius:8,fontFamily:'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'}}}><BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter></ConfigProvider></QueryClientProvider></React.StrictMode>
);
