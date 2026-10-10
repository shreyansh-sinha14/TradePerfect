import React from 'react';
import {Navigate,useLocation} from 'react-router-dom';
import {can} from '@tradeperfect/shared';
import {useAuth} from './AuthContext';
export default function RequireRole({permission,children}){
 const {user}=useAuth();const location=useLocation();
 if(!user)return <Navigate to="/login" replace state={{from:location}}/>;
 if(permission&&!can(user,permission))return <Navigate to="/403" replace/>;
 return children;
}
