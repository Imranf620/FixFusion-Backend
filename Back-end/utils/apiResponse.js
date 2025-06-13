export const apiResponse = (
    res,                 
    {
      data = null,        
      message = '',       
      statusCode = 200,   
      error = null,      
      meta = null         
    }
  ) => {
    return res.status(statusCode).json({
      statusCode,
      message,
      data,
      ...(error && { error }),
      ...(meta && { meta }),
    });
  };
  