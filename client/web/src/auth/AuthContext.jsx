import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {authApi} from '../api/authApi';
import {tokenStore} from './tokenStore';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(()=>tokenStore.getUser());
 const [token,setToken]=useState(()=>tokenStore.getToken());
 useEffect(()=>{if(token&&!user){authApi.me().then(r=>setUser(r.user||r)).catch(()=>{tokenStore.clearToken();setToken(null);setUser(null);});}},[]);
 const login=async(username,password)=>{const result=await authApi.login(username,password);const tok=result.token||result.accessToken;const u=result.user||result;tokenStore.setToken(tok);tokenStore.setUser(u);setToken(tok);setUser(u);return u;};
 const logout=()=>{tokenStore.clearToken();setToken(null);setUser(null);};
 const value=useMemo(()=>({user,token,login,logout}),[user,token]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
