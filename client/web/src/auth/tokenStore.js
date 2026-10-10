const KEY = 'tradeperfect.token';
const USER_KEY = 'tradeperfect.user';
let memoryToken = null;
export const tokenStore = {
  getToken(){ return memoryToken || sessionStorage.getItem(KEY); },
  setToken(token){ memoryToken=token; sessionStorage.setItem(KEY,token); },
  clearToken(){ memoryToken=null; sessionStorage.removeItem(KEY); sessionStorage.removeItem(USER_KEY); },
  getUser(){ try{return JSON.parse(sessionStorage.getItem(USER_KEY)||'null')}catch{return null} },
  setUser(user){sessionStorage.setItem(USER_KEY,JSON.stringify(user));}
};
