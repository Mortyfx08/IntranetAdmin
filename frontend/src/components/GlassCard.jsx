import React from 'react';
import { Card } from 'antd';

const GlassCard = ({ children, title, style, className, ...props }) => {
  return (
    <Card
      title={title}
      bordered={false}
      className={`glass-effect glass-hover animate-fade-in ${className || ''}`}
      style={{
        borderRadius: '16px',
        color: 'white',
        ...style,
      }}
      headStyle={{
        color: 'rgba(255, 255, 255, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '18px',
        fontWeight: '600',
        padding: '16px 24px',
      }}
      bodyStyle={{
        padding: '24px',
      }}
      {...props}
    >
      {children}
    </Card>
  );
};

export default GlassCard;
