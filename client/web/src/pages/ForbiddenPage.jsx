import React from 'react';import {Result,Button} from 'antd';import {useNavigate} from 'react-router-dom';
export default function ForbiddenPage(){const n=useNavigate();return <Result status="403" title="403" subTitle="Your role does not have access to this page." extra={<Button type="primary" onClick={()=>n('/dashboard')}>Go to permitted page</Button>}/>;}
