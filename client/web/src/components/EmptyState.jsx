import React from 'react';import {Empty} from 'antd';
export default function EmptyState({description='No records found'}){return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}/>;}
