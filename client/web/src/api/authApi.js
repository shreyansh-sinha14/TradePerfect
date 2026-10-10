import { api, useMocks } from './client';
import { sleep } from './mockData';
export const authApi = {
  async login(username,password){
    if(useMocks()){await sleep();if(!username?.trim()||!password) {const e={status:401,code:'UNAUTHORIZED',message:'Invalid username or password.',details:[]};throw e;}
      const roleByName={'trader':'TRADER','ops_user':'OPS_USER','ops_manager':'OPS_MANAGER','ml_admin':'ML_ADMIN','sys_admin':'SYS_ADMIN'};
      const role=roleByName[username.toLowerCase()]||'OPS_MANAGER';
      return {token:`demo.${btoa(`${username}:${role}`)}.token`,user:{userId:`u-${username.toLowerCase()}`,username,name:username.replace(/[_\.]/g,' '),role}};
    }
    return (await api.post('/auth/login',{username,password})).data;
  },
  async me(){if(useMocks()){await sleep();return {user:JSON.parse(sessionStorage.getItem('tradeperfect.user')||'null')};}return (await api.get('/auth/me')).data;}
};
