import React from 'react';import {Result,Button} from 'antd';import {useNavigate} from 'react-router-dom';
export default function NotFoundPage(){const n=useNavigate();return <Result status="404" title="404" subTitle="The page you requested does not exist." extra={<Button type="primary" onClick={()=>n('/dashboard')}>Go to dashboard</Button>}/>;}
