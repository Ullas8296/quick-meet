import { Box, Button, Typography } from '@mui/material';
import { useEffect } from 'react';
import { GoogleIcon } from '@components/CustomIcons';
import { useLocation, useNavigate } from 'react-router-dom';
import { CacheService, CacheServiceFactory } from '@helpers/cache';
import { secrets } from '@config/secrets';
import { ROUTES } from '@config/routes';
import toast from 'react-hot-toast';
import Api from '@api/api';
import { isChromeExt, renderError } from '@helpers/utility';
import type { ApiResponse } from '@quickmeet/shared';

const cacheService: CacheService = CacheServiceFactory.getCacheService();
const api = new Api();

const Login = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const errorMessage = state?.message;

  if (errorMessage) {
    toast.error(errorMessage);
  }

  useEffect(() => {
    const validateSession = async () => {
      const token = await cacheService.get('access_token');
      if (token) {
        navigate(ROUTES.home);
      }
    };

    validateSession();
  }, []);

  async function onSignInClick(): Promise<void> {
    if (secrets.appEnvironment === 'chrome') {
      const res: ApiResponse<any> | undefined = await api.loginChrome();
      if (!res) {
        return;
      }

      const { data, status } = res;

      if (status !== 'success') {
        return renderError(res, navigate);
      }

      if (data) {
        const cacheService: CacheService = CacheServiceFactory.getCacheService();
        await cacheService.save('access_token', data);
        navigate(ROUTES.home, { replace: true });
      }
    } else {
      await api.login();
    }
  }

  return (
    <Box
      mx={2}
      mt={1}
      sx={{
        flexGrow: 1,
        position: 'relative',
      }}
    >
      <Box mt={18} display={'flex'} flexDirection={'column'} zIndex={100}>
        <Typography variant="h2" sx={[(theme) => ({ color: theme.palette.text.primary, width: '100%' })]}>
          {secrets.appTitle}
        </Typography>
        <Typography variant="h5" sx={[(theme) => ({ color: theme.palette.text.secondary, fontWeight: 400, mt: 1 })]}>
          {secrets.appSlogan}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 4 }}>
        <Box sx={{ px: isChromeExt ? 3 : 10 }}>
          <Button
            type="submit"
            sx={[
              (theme) => ({
                height: 70,
                backgroundColor: theme.palette.common.white,
                color: theme.palette.common.black,
                fontSize: theme.typography.h6,
                fontWeight: 700,
                borderRadius: 20,
                zIndex: 101,
                '& .MuiButton-startIcon': {
                  marginRight: theme.spacing(3),
                },
              }),
            ]}
            fullWidth
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={onSignInClick}
          >
            Sign in
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
