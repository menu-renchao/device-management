const hasDisplayableDetailData = (data) => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const { error, ...rest } = data;
  void error;

  return Object.values(rest).some((value) => value !== null && value !== undefined);
};

export const getDetailModalState = (payload) => {
  const detailData = payload?.data;
  const detailError = typeof detailData?.error === 'string' ? detailData.error.trim() : '';

  if (detailError) {
    return {
      status: 'error',
      message: detailError
    };
  }

  if (payload?.success === true && hasDisplayableDetailData(detailData)) {
    return {
      status: 'success',
      data: detailData
    };
  }

  return {
    status: 'empty',
    message: '暂无可展示的设备详情'
  };
};
